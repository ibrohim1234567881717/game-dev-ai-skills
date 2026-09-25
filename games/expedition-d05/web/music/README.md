# Музыка UMBRA

Сюда кладутся записанные треки. Игра сама подхватывает их при сборке. Если
какого-то файла нет, в этом месте звучит встроенная синтезированная партитура.
Поэтому треки можно добавлять по одному.

## Где звучит музыка и где нет

В UMBRA хищника **слышно раньше, чем видно**. Затихшие насекомые, шаги,
дыхание за кустами работают как подсказки. Фоновая музыка во время скрытного
прохождения заглушила бы их. Поэтому музыка звучит в меню, в ключевых сценах
и во время опасности, а исследование острова озвучено только окружением.

| Файл | Где звучит | Настроение | Длина | Петля |
|---|---|---|---|---|
| `menu` | Титульный экран, главное меню, выбор глав, настройки | Тайна, тревожная красота, туман над долиной | 2–3 мин | да |
| `island` | Глава I: вертолёт выходит из грозы, внизу долина со стадом | Изумление, первый взгляд на живых динозавров | 40–60 с | нет |
| `danger` | Погоня, атака стада, вас заметили, Королева на охоте | Напряжение, пульс, без мелодии | 1–2 мин | да |
| `truth` | Лагерь D-04: правда о Хальме и «Протоколе Пепел» | Горечь, откровение, медленно | 40–60 с | нет |
| `finale` | Глава «Рассвет»: вуаль отключена, путь к Маяку | Решимость, надежда, свет после долгой ночи | 2–3 мин | да |
| `ending` | Финальные кадры → карточки концовки → титры | Катарсис, тихая грусть, прощание с островом | 2:30–3:30 | нет |

Во время паузы музыка звучит тише (35 %). Громкость настраивается в
«Настройки → Звук → Музыка».

`danger` включается, когда появляется угроза. Когда угроза проходит, он звучит
ещё 5 секунд, а потом плавно возвращает трек, который играл до него (например,
`finale`).

## Требования к файлам

- **Имя файла = название трека**: `menu.mp3`, `danger.ogg` и так далее.
  Подходят `.mp3`, `.ogg`, `.m4a`, `.wav`. Лучше MP3 (≈160 кбит/с, стерео,
  44,1 или 48 кГц): WAV весит в десять раз больше.
- **Без вокала и слов.** В сценах идёт озвучка, голос поверх голоса не
  разобрать. Хоры без слов («аа», «оо») допустимы в `island` и `ending`.
- **Без тишины в начале и в конце** больше полсекунды.
- **Громкость ≈ −16…−18 LUFS**, пики не выше −1 dBFS. Если генератор не
  показывает LUFS, выровняйте треки на слух по `menu`.
- **Петли** (`menu`, `danger`, `finale`) не обязаны зацикливаться идеально:
  игра сама делает трёхсекундный кроссфейд с началом. Но лучше, если конец
  звучит так же, как начало: без финального аккорда и без затухания.
- **Без петли** (`island`, `truth`, `ending`): у трека должен быть настоящий
  конец. `ending` начинается с первого кадра финала и идёт под карточки и
  титры (≈45 с), поэтому длиннее остальных.

Общая тональность партитуры — ля минор (Am – Fmaj7 – Cadd9 – Em), главный мотив
A–C–E–D. Попадать в неё не обязательно, но треки в одной тональности звучат как
один саундтрек.

## Промпты для генератора

Английский генераторы понимают лучше. Добавьте к каждому промпту
`instrumental, no vocals`, если в генераторе нет отдельной галочки.

**menu**
> Cinematic ambient score for a survival exploration game main menu. Slow,
> mysterious and beautiful. Warm analog synth pads, distant low strings, soft
> felt piano notes, a faint deep drum far away. A foggy prehistoric valley at
> dusk. A minor, 60 BPM, sparse, lots of space. Seamless loop, no ending, no
> fade out. Instrumental, no vocals.

**island**
> Orchestral cinematic reveal cue. A helicopter breaks through storm clouds and
> a hidden valley full of living dinosaurs appears below. Starts quiet and
> tense with tremolo strings, then swells into awe: wide brass, strings, soft
> wordless choir, timpani. Wonder, not triumph. A minor to C major lift.
> 50 seconds with a clear ending. Instrumental.

**danger**
> Tense survival-horror stealth chase music. A low pulsing synth ostinato,
> taiko and low toms, staccato cellos, metallic scrapes, heartbeat-like sub
> bass. No melody, relentless and driving. 120 BPM, D minor. Seamless loop,
> no intro, no ending. Instrumental, no vocals.

**truth**
> Somber cinematic revelation cue. A betrayal comes to light in an abandoned
> research camp in the rain. Solo cello over a low string drone, sparse
> piano, a distant ominous brass swell near the end. Slow, heavy and
> emotional. A minor, 60 BPM. 50 seconds with a clear ending. Instrumental.

**finale**
> Hopeful yet urgent cinematic score. The sun rises over a jungle island for
> the first time in forty years; the heroes race to a lighthouse. Driving
> strings ostinato, rising brass, steady percussion, warm synth pads. Resolve
> and hope, building but never fully resolving. A minor, 100 BPM. Seamless
> loop, no ending. Instrumental, no vocals.

**ending**
> Emotional orchestral finale and end credits theme for an adventure game.
> Begins with a gentle piano motif (A–C–E–D), strings join, builds to a warm
> cathartic climax with wordless choir, then slowly settles into quiet
> reflective piano for the credits. Bittersweet farewell to a lost world.
> A minor to C major. 3 minutes with a real ending. Instrumental.

## Как добавить

1. Положите файлы в эту папку: `games/expedition-d05/web/music/menu.mp3` и т. д.
2. Соберите игру:
   ```
   python games/expedition-d05/web/build.py
   ```
   Сборка копирует треки в `dist/music/` и выводит, какие нашла:
   `music: 3 track(s) (danger, finale, menu)`. Файлы с другими именами
   пропускаются с предупреждением.
3. Откройте `dist/umbra.html`. Папка `dist/music/` должна лежать рядом с
   `umbra.html`: треки не встраиваются в страницу, иначе она весила бы
   десятки мегабайт. Если переносите игру, копируйте всю папку `dist/`.
4. Закоммитьте файлы из `music/` вместе с пересобранным `dist/`.

Собрать без музыки (сравнить со встроенной партитурой):
`python games/expedition-d05/web/build.py --no-music`.

Проверить в консоли браузера (F12), что трек загружен:
`__umbra.Music.files` покажет список треков, `__umbra.Music.cur.name` — какой
играет сейчас.
