# Музыка UMBRA

В этой папке лежат шесть треков, которые играет игра. Рядом, в `source/`, —
оригиналы от автора, как они были сданы; их никто не трогает. Файлы верхнего
уровня собраны из оригиналов и выровнены по громкости.

Сборка (`build.py`) копирует отсюда в `dist/music/` только файлы, названные
точно по имени момента. Папка `source/` при этом не просматривается.

## Где звучит музыка и где нет

В UMBRA хищника **слышно раньше, чем видно**. Затихшие насекомые, шаги,
дыхание за кустами работают как подсказки. Фоновая музыка во время скрытного
прохождения заглушила бы их. Поэтому музыка звучит в меню, в ключевых сценах
и во время опасности, а исследование острова озвучено только окружением.

| Файл | Где звучит | Петля | Собран из |
|---|---|---|---|
| `menu.mp3` | Титульный экран, главное меню, главы, настройки | да | `source/menu.mp3` |
| `island.mp3` | Глава I: вертолёт выходит из грозы, внизу долина со стадом | нет | `source/island.mp3` |
| `danger.mp3` | Погоня, атака стада, вас заметили, Королева на охоте | да | `source/danger (2).mp3` |
| `truth.mp3` | Лагерь D-04: правда о Хальме и «Протоколе Пепел» | нет | `source/truth.mp3` |
| `finale.mp3` | Глава «Рассвет»: вуаль отключена, путь к Маяку | да | `source/finale.mp3` |
| `ending.mp3` | Финальные кадры → карточки концовки → титры | да | `source/ending.mp3` |

Все шесть — по 30 секунд, 48 кГц, стерео, 192 кбит/с, ≈4,1 МБ на все вместе.

Что делает игра с этими тридцатью секундами:

- **Петли** повторяются бесшовно: за 3 секунды до конца игра запускает вторую
  копию трека с начала и переводит звук на неё. Склейки не слышно.
- **`ending` тоже зациклен**: концовка идёт от финальных кадров через карточки
  до титров — это дольше трёх минут, одного прохода не хватило бы.
- **`island` и `truth`** играют один раз и затихают: у них есть настоящий конец.
- **`danger`** включается вместе с опасностью, держится 5 секунд после неё и
  плавно возвращает трек, который играл до этого (например, `finale`).
- В паузе громкость падает до 35 %. Общая громкость — «Настройки → Звук».

## Что было сделано с оригиналами

Автор сдал по две версии каждого трека: 30-секундную и длинную (1–3 минуты).
Замеры подтвердили, что короткие чище: они нигде не подходят к 0 dBFS, тогда
как длинные сведены заметно горячее. Поэтому в игру пошли короткие.

Громкость у сданных 30-секундных версий расходилась на 10 дБ (от −12,3 до
−22,6 LUFS): `menu` звучал бы вдвое громче остальных, `island` почти пропадал.
Все шесть приведены к **−17 LUFS, пик не выше −1,5 dBTP**, так что ни один не
выделяется. `island` и `truth` обрывались на полном уровне — им добавлено
затухание 3 секунды в конце. Петли оставлены без затуханий: их конец должен
совпадать с началом.

Если нужно повторить обработку после замены оригинала:

```bash
ffmpeg -i "source/ИМЯ.mp3" -af loudnorm=I=-17:TP=-1.5:LRA=11:print_format=json -f null -
# подставить измеренные значения во второй проход:
ffmpeg -i "source/ИМЯ.mp3" -af "loudnorm=I=-17:TP=-1.5:LRA=11:measured_I=…:measured_TP=…:\
measured_LRA=…:measured_thresh=…:offset=…:linear=true,aresample=48000" \
  -ar 48000 -ac 2 -c:a libmp3lame -b:a 192k ЦЕЛЬ.mp3
```

Для `island` и `truth` в конец цепочки добавляется `,afade=t=out:st=27:d=3`.

## Если делать новые треки

- **Имя файла = название момента** из таблицы. Подходят `.mp3`, `.ogg`,
  `.m4a`, `.wav`. Лучше MP3, ≈192 кбит/с, стерео.
- **Без вокала и слов.** В сценах идёт озвучка, голос поверх голоса не
  разобрать. Хоры без слов («аа», «оо») допустимы в `island` и `ending`.
- **Без тишины в начале и в конце** больше полсекунды.
- **Громкость −16…−18 LUFS**, пики не выше −1 dBFS.
- **Петли** не обязаны сходиться идеально — игра делает кроссфейд, — но конец
  не должен затухать и должен звучать похоже на начало.
- **Без петли** (`island`, `truth`): нужен настоящий конец.
- Длиннее 30 секунд — можно и лучше: 30-секундная петля в меню повторяется
  каждые полминуты. Минута-полторы заметно освежит меню и «Рассвет».

Общая тональность партитуры — ля минор (Am – Fmaj7 – Cadd9 – Em), главный мотив
A–C–E–D. Попадать в неё не обязательно, но треки в одной тональности звучат как
один саундтрек.

### Промпты для генератора

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

## Как заменить трек

1. Положите новый файл в `source/`, а выровненную версию — сюда, под именем
   момента (`menu.mp3` и так далее). Команды выравнивания — выше.
2. Пересоберите игру:
   ```
   python games/expedition-d05/web/build.py
   ```
   Сборка напишет, что нашла: `music: 6 track(s) (danger, ending, …)`.
   Файлы с другими именами пропускаются с предупреждением.
3. Откройте `dist/umbra.html`. Папка `dist/music/` должна лежать рядом с
   `umbra.html`: треки не встраиваются в страницу, иначе она весила бы
   десятки мегабайт. Если переносите игру, копируйте всю папку `dist/`.

Собрать без музыки (сравнить со встроенной синтезированной партитурой):
`python games/expedition-d05/web/build.py --no-music`.

Проверить в консоли браузера (F12): `__umbra.Music.files` покажет список
треков, `__umbra.Music.cur.name` — какой играет сейчас.
