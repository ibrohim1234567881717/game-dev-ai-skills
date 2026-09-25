# Озвучка UMBRA (Qwen3-TTS, офлайн)

Реплики игры озвучиваются заранее, на вашем компьютере, и встраиваются в
`dist/umbra.html` при сборке. В игре звук играет вместе с субтитрами. Реплики
по рации, интеркому и из записей игра сама пропускает через «радиофильтр»,
поэтому генерируется чистый голос.

| Файл | Что это |
|---|---|
| [extract_lines.py](extract_lines.py) | Находит в `src/*.js` все реплики персонажей и пишет `lines.json` |
| [lines.json](lines.json) | Список реплик: id, персонаж, текст для синтеза (`say`), эмоция, рация или нет, файл:строка |
| [voices.json](voices.json) | Голоса персонажей, таблица «подпись → персонаж», произношение, эмоции |
| [generate.py](generate.py) | Синтез через Qwen3-TTS → `audio/<персонаж>/<id>.mp3` и `audio/manifest.json` |
| [../build.py](../build.py) | Сборка игры; если есть `audio/manifest.json`, встраивает звук |

## Какая модель что умеет

Проверено по исходникам пакета `qwen-tts` 0.1.1 (PyPI):

| Модель | Голоса | Эмоции и стиль по тексту-инструкции |
|---|---|---|
| `Qwen3-TTS-12Hz-0.6B-CustomVoice` | 9 готовых голосов | **нет**: пакет сам отбрасывает инструкцию для 0.6B |
| `Qwen3-TTS-12Hz-0.6B-Base` | клон по записи 10–20 с | нет |
| `Qwen3-TTS-12Hz-1.7B-CustomVoice` | 9 готовых голосов | да |
| `Qwen3-TTS-12Hz-1.7B-VoiceDesign` | голос по описанию из `voices.json` | да |
| `Qwen3-TTS-12Hz-1.7B-Base` | клон по записи | нет |

Модели VoiceDesign для 0.6B нет. На 0.6B эмоции передаются тем, что остаётся:
темп (`speed`), высота (`pitch_semitones`, нужна, чтобы различать персонажей с
одним и тем же готовым голосом) и громкость (`gain_db`: шёпот тише).

Готовые голоса (Vivian, Serena, Uncle_Fu, Dylan, Eric, Ryan, Aiden, Ono_Anna,
Sohee) — носители китайского, английского, японского и корейского. По-русски
они, скорее всего, говорят с акцентом. Послушайте первые реплики и решите сами.
Самый естественный русский, вероятно, даст клонирование (Base) с настоящей
русской записью голоса.

## Первый запуск (Windows, PowerShell)

Нужен Python **3.10–3.12**: на 3.9 `qwen-tts` 0.1.1 не импортируется (в коде
есть аннотации `str | None`). Авторы советуют 3.12.

```powershell
cd C:\путь\к\game-dev-ai-skills
py -3.12 -m venv .venv-tts
.\.venv-tts\Scripts\Activate.ps1
```

Если PowerShell не даёт запустить `Activate.ps1`, выполните один раз
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**PyTorch ставится до `qwen-tts`**, иначе pip поставит сборку только для CPU.
Для видеокарты NVIDIA возьмите команду на pytorch.org (раздел Get Started).
Номер `cu…` в адресе зависит от версии; ниже только пример:

```powershell
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu126
```

Без видеокарты: `pip install torch torchaudio`. Затем:

```powershell
pip install -U qwen-tts soundfile
python -c "import torch; print(torch.__version__, 'CUDA:', torch.cuda.is_available())"
```

**Модель.** Если 0.6B скачана через `huggingface-cli`, она лежит в
`C:\Users\<вы>\.cache\huggingface\hub\models--Qwen--Qwen3-TTS-12Hz-0.6B-...`.
`generate.py` найдёт её сам и напечатает, какую модель взял. Ещё он ищет в
папках `models` рядом со скриптом и с репозиторием, в `~\models`,
`~\Downloads` и `C:\models`. Если модель лежит в другом месте, укажите папку
через `--model`. В папке должны быть `config.json` и подпапка
`speech_tokenizer\`.

```powershell
# 1. собрать реплики из игры (повторяйте после каждого изменения диалогов)
python games\expedition-d05\web\voice\extract_lines.py

# 2. посмотреть план: модель, голоса, эмоции; ничего не пишет
python games\expedition-d05\web\voice\generate.py --dry-run --limit 10

# 3. пробные 5 реплик, послушать файлы в voice\audio\
python games\expedition-d05\web\voice\generate.py --limit 5
#    или с явной моделью и устройством:
python games\expedition-d05\web\voice\generate.py --model C:\models\Qwen3-TTS-12Hz-0.6B-CustomVoice --device cuda --limit 5

# 4. всё остальное (можно прервать Ctrl+C и потом запустить снова, продолжит)
python games\expedition-d05\web\voice\generate.py

# 5. собрать игру со звуком и открыть
python games\expedition-d05\web\build.py
Invoke-Item games\expedition-d05\web\dist\umbra.html
```

Сборка печатает, сколько клипов и мегабайт встроено. three.js игра грузит с
CDN, так что для запуска нужен интернет. Собрать без звука можно так:
`build.py --no-voice`. Звук из другой папки: `build.py --voice-dir D:\umbra-voice\audio`.

## Переделать одну реплику или персонажа

Уже готовые файлы **никогда не перезаписываются без `--force`**. Удачные дубли
не пропадут.

```powershell
# id реплики ищите в lines.json по тексту
python games\expedition-d05\web\voice\generate.py --only 12fbd71b --force --seed 1   # другой дубль
python games\expedition-d05\web\voice\generate.py --only lena --force                # весь персонаж
python games\expedition-d05\web\voice\generate.py --only lena,diego                  # только недостающие
python games\expedition-d05\web\voice\generate.py --list-speakers                    # голоса и прогресс
```

Другой способ — удалить файл `voice\audio\<персонаж>\<id>.mp3` и запустить
без `--force`. Свою запись можно положить под тем же именем (`.mp3`, `.ogg`
или `.wav`): скрипт добавит её в манифест как есть. В конце запуска скрипт
перечисляет клипы подозрительной длины (повтор или обрыв) — их стоит
послушать и переделать с другим `--seed`.

Когда в игре меняется текст реплики, меняется и её id: новая версия
сгенерируется, старый клип останется лишним. `--prune` переносит такие клипы
в `audio\_pruned\`.

## Настройка голосов (`voices.json`)

- `speakers.<ключ>`: `preset` (готовый голос), `pitch_semitones`, `speed`,
  `style` и `emotions` (инструкции для 1.7B), `description` (для VoiceDesign),
  `ref_text` (фраза для образца голоса при клонировании).
- `pronounce`: замены перед синтезом, например `"D-04": "Дэ-ноль-четыре"`.
  Помогает, если модель читает латиницу или цифры не так.
- `line_overrides`: правка одной реплики по id:
  `"12fbd71b": {"say": "…", "emotion": "quiet"}`. Применяется при следующем
  `extract_lines.py`.
- `directions`: какие ремарки в тексте (`<em>(шёпотом)</em>`) дают какую эмоцию.
- Новый персонаж: префикс подписи в `who_map` и профиль в `speakers`.
  `build.py` передаёт таблицу в игру как `window.VOICE_SPEAKERS`. Проверьте,
  что `src/12-voice.js` берёт её оттуда или знает тот же префикс в своей
  таблице `VOICE_SPEAKERS`, иначе игра не найдёт звук.

## Если 0.6B звучит недостаточно хорошо

Сначала доведите 0.6B до предела: попробуйте другие `preset`, `speed` и
`--seed`. Модели 1.7B тяжелее и медленнее. Скачайте нужную, например:

```powershell
huggingface-cli download Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice --local-dir C:\models\Qwen3-TTS-12Hz-1.7B-CustomVoice
```

В новых версиях `huggingface_hub` та же команда называется `hf download`.

Сравните на одном персонаже. Скопируйте `voice\audio` в запас, потому что
`--force` заменит файлы:

```powershell
python games\expedition-d05\web\voice\generate.py --model C:\models\Qwen3-TTS-12Hz-1.7B-CustomVoice --only lena --force
```

- **1.7B-CustomVoice** — те же готовые голоса, но с эмоциями и стилем из
  `voices.json`.
- **1.7B-VoiceDesign** (`Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign`) — голос каждого
  персонажа строится по его `description`. Каждая реплика синтезируется
  заново, поэтому тембр между репликами может немного гулять.
- **Образец от 1.7B, синтез на 0.6B.** 1.7B один раз создаёт образцы
  `voice\refs\<персонаж>.wav`, дальше 0.6B-Base клонирует их, и тембр стабилен:

  ```powershell
  python games\expedition-d05\web\voice\generate.py --model C:\models\Qwen3-TTS-12Hz-0.6B-Base --ref-model C:\models\Qwen3-TTS-12Hz-1.7B-VoiceDesign
  ```

  Вместо сгенерированного образца можно положить свою запись
  `refs\<персонаж>.wav` (10–20 с, один голос, без музыки) и её текст в
  `refs\<персонаж>.txt`. Для эмоций можно добавить отдельные образцы
  `refs\<персонаж>.<эмоция>.wav` (например `lena.whisper.wav`).

## Неполадки

- **«cannot write MP3»** — старая библиотека libsndfile. Обновите:
  `pip install -U soundfile` (MP3 умеет soundfile 0.12 и новее). Иначе скрипт
  сам пишет OGG, а если нельзя и OGG, то WAV: он большой, HTML разрастётся.
  Учтите, что OGG не играет в старых версиях Safari.
- **`import qwen_tts` падает на `torchaudio`.** Пакет импортирует
  `torchaudio.compliance.kaldi`. Если в самой новой версии torchaudio этого
  модуля нет, поставьте пару torch/torchaudio постарше, одной версии. Это
  предположение, не проверено.
- **`CUDA: False`** — стоит сборка PyTorch для CPU. Переустановите с
  `--index-url` (см. выше). `--device cuda` в этом случае сразу скажет об ошибке.
- **Скорость.** На видеокарте NVIDIA генерация идёт в разы быстрее, чем на CPU.
  Время каждой реплики печатается в скобках: запустите `--limit 5` и прикиньте,
  сколько уйдёт на все.
- **Не хватает видеопамяти** — `--dtype fp16` или `--device cpu`. Старые
  карты (GTX 10xx/16xx, RTX 20xx) не умеют bf16; скрипт сам выберет fp16, а
  при ошибках попробуйте `--dtype fp32`.
- **Предупреждение «SoX could not be found»** при импорте `qwen-tts`. Пакет
  импортирует `sox` для старого 25Hz-токенизатора. Для моделей 12Hz это, по
  всей видимости, безвредно, но проверено только по коду, не запуском.
- **HTML больше 15 МБ** — `build.py` предупредит. Меньше реплик или более
  сильное сжатие: `generate.py --force --mp3-level 0.5` (это синтез заново).
- **Проверить весь конвейер без модели:** `generate.py --mock --limit 3` пишет
  гудки вместо речи. Потом удалите папку `voice\audio`.

API `qwen-tts` может меняться между версиями. Названия методов в
`generate.py` сверены с версией 0.1.1. Если пакет обновился и что-то упало,
проверьте `pip show qwen-tts` и файл `qwen_tts\inference\qwen3_tts_model.py`.
