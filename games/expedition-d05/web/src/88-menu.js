// ============================================================
// 88-menu.js — title screen, main menu, chapters, settings, credits, pause
//
// One layer (#menu) holds a stack of screens. Each screen is rebuilt when
// it opens, so it always shows current state. Keyboard and mouse share one
// focus: arrows or WASD move it, hovering moves it, Enter/Space activate,
// Esc/Backspace go back, and in settings ←→ change the focused value. The
// key handler runs in the capture phase and only while a menu, the journal
// or a decision panel is open, so gameplay keys never reach both.
// ============================================================
const ROMAN = { prologue: '0', valley: 'I', k4: 'II', river: 'III', peaks: 'IV', truth: 'V', queen: 'VI', dawn: 'VII' };
// edit freely: the credits roll is built from this list
const CREDITS = [
  { head: 'Автор игры', lines: ['ibrohim1234567881717', '<small>идея, сюжет, геймдизайн, 3D-модели</small>'] },
  { head: 'Программирование и технический дизайн', lines: ['Claude Code'] },
  { head: 'Действующие лица', cast: [
    ['Итан Рид', 'следопыт'], ['Лена Арден', 'палеогенетик'], ['Виктор Хальм', 'руководитель экспедиции'], ['Диего Рамос', 'охрана'],
    ['Лукас Ортис', 'пилот'], ['Нора Квист', 'оператор связи станции «Порог»'], ['Юсуф', 'техник базы'], ['Ада Кесслер', 'совет ORIGO'],
    ['Мара Линд', 'руководитель экспедиции D-04'], ['Элиас Варн', 'создатель острова'], ['Пилот D-02', 'бортовой самописец'],
  ] },
  { head: 'Голоса', lines: ['Синтез речи Qwen3-TTS 1.7B VoiceDesign', '<small>каждому персонажу — свой голос по описанию</small>'] },
  { head: 'Технологии', lines: ['three.js — 3D в браузере', 'Web Audio API — музыка и звук, синтезированные в реальном времени', 'Fira Sans · Fira Sans Extra Condensed · IBM Plex Mono', '<small>шрифты под лицензией SIL Open Font License</small>'] },
];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = {
  lock: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  back: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
};
function pipsHtml(have, eva) {
  const codes = [['tri', 'TRI'], ['rap', 'RAP'], ['spi', 'SPI'], ['pte', 'PTE'], ['rex', 'REX']];
  return `<div class="pips">${codes.map(([k, c]) => `<span class="pip ${have.includes(k) ? 'ok' : ''}">${c}</span>`).join('')}${eva ? '<span class="pip eva">EVA</span>' : ''}</div>`;
}
function fmtSaved(t) {
  if (!t) return '';
  const d = new Date(t), now = new Date();
  const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  if (diff === 0) return `сегодня, ${hm}`;
  if (diff === 1) return `вчера, ${hm}`;
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, ${hm}`;
}
const KEYS_HELP = [
  ['W A S D', 'идти'], ['Мышь', 'осмотреться'], ['Shift', 'бежать'], ['C', 'присесть: тише и незаметнее'],
  ['E', 'действие; удерживать — долгие действия'], ['F', 'камера'], ['Пробел', 'снимок или выстрел'], ['Q', 'бросить приманку'],
  ['J', 'полевой журнал'], ['Tab', 'напомнить цель'], ['Enter', 'ускорить кат-сцену'], ['Esc', 'пауза'], ['M', 'выключить звук'],
];
const TOUCH_HELP = [['Левый палец', 'идти'], ['Джойстик до упора', 'бег'], ['Правый палец', 'осмотреться'], ['Кнопки справа', 'действие, присесть, камера, журнал, цель, пауза']];

// ---------- settings rows ----------
const SUB_SIZES = ['Мелкий', 'Средний', 'Крупный', 'Очень крупный'];
const SET_TABS = [
  { name: 'Графика', rows: [
    { k: 'gfx', label: 'Качество графики', type: 'choice', opts: ['Низкое', 'Среднее', 'Высокое'], get: () => GFX.level, set: (v) => { Post.apply(v); Perf.stepped = true; },
      desc: 'Низкое — без пост-обработки и с простыми тенями, для слабых ноутбуков и телефонов. Высокое — сглаживание, мягкие тени и полная плотность растительности. Тени и эффекты меняются сразу, растительность — при следующей загрузке главы.' },
    { k: 'bright', label: 'Яркость', type: 'slider', min: 1, max: 10, step: 1, preview: 'bright',
      desc: 'Настройте так, чтобы левый знак был едва различим, а правый — хорошо виден. Ночные главы и пещеры задуманы тёмными.' },
    { k: 'fov', label: 'Поле зрения', type: 'slider', min: 50, max: 80, step: 1, fmt: (v) => `${v}°`,
      desc: 'Угол обзора камеры от третьего лица. Шире — больше видно по сторонам, но животные вдали кажутся меньше. Кат-сцены и камера не меняются.' },
    { k: 'shake', label: 'Тряска камеры', type: 'slider', min: 0, max: 100, step: 10, fmt: (v) => `${v}%`,
      desc: 'Шаги тираннозавра, удары и турбулентность. Уменьшите, если от тряски укачивает.' },
    { k: 'full', label: 'Полноэкранный режим', type: 'toggle', hide: () => !document.fullscreenEnabled,
      get: () => !!document.fullscreenElement, set: (on) => { try { if (on) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen().catch(() => {}); } catch (e) { /* not allowed here */ } },
      desc: 'Весь экран без панелей браузера. Выход — Esc или F11.' },
    { k: 'fps', label: 'Счётчик кадров', type: 'toggle', desc: 'Показывает частоту кадров внизу экрана. Для проверки производительности.' },
  ] },
  { name: 'Звук', rows: [
    { k: 'master', label: 'Общая громкость', type: 'slider', min: 0, max: 100, step: 5, desc: 'Громкость всей игры. M во время игры выключает и включает звук.' },
    { k: 'music', label: 'Музыка', type: 'slider', min: 0, max: 100, step: 5, desc: 'Музыка меню и музыкальные темы сюжета.' },
    { k: 'voice', label: 'Голоса', type: 'slider', min: 0, max: 100, step: 5, desc: 'Громкость реплик персонажей.' },
    { k: 'sfx', label: 'Эффекты', type: 'slider', min: 0, max: 100, step: 5, desc: 'Шаги, животные, техника, вертолёт и звуки интерфейса.' },
    { k: 'amb', label: 'Окружение', type: 'slider', min: 0, max: 100, step: 5, desc: 'Ветер, насекомые, дождь и вода. Насекомые замолкают, когда рядом хищник — не выключайте окружение совсем.' },
    { k: 'voiceOn', label: 'Озвучка персонажей', type: 'toggle', hide: () => !Voice.count(),
      desc: 'Если выключить, останутся только субтитры.' },
  ] },
  { name: 'Управление', help: true, rows: [
    { k: 'sens', label: IS_TOUCH ? 'Чувствительность обзора' : 'Чувствительность мыши', type: 'slider', min: 1, max: 10, step: 1, desc: 'Скорость поворота камеры. 5 — стандартная.' },
    { k: 'invertY', label: 'Инвертировать ось Y', type: 'toggle', desc: 'Движение вверх опускает камеру, как в авиасимуляторах.' },
  ] },
  { name: 'Интерфейс', rows: [
    { k: 'subs', label: 'Субтитры', type: 'toggle', preview: 'sub', desc: 'Текст реплик внизу экрана. Реплики без озвучки показываются всегда.' },
    { k: 'subSize', label: 'Размер субтитров', type: 'choice', opts: SUB_SIZES, preview: 'sub', desc: 'Крупнее — легче читать на большом экране издалека.' },
    { k: 'subBg', label: 'Фон субтитров', type: 'toggle', preview: 'sub', desc: 'Тёмная подложка под текстом: читается на ярком небе и снегу.' },
    { k: 'hints', label: 'Обучающие подсказки', type: 'toggle', desc: 'Короткие подсказки слева о клавишах и приёмах, по одной в нужный момент.' },
    { k: 'waypoint', label: 'Маркер цели', type: 'toggle', desc: 'Ромб с расстоянием появляется, если вы долго не можете найти дорогу. Когда выключен, маркер показывает только Tab.' },
  ] },
];
function rowValue(r) { return r.get ? r.get() : Settings.v[r.k]; }
function rowSet(r, v) { if (r.set) r.set(v); else Settings.set(r.k, v); }
function rowText(r, v) {
  if (r.type === 'toggle') return v ? 'Вкл' : 'Выкл';
  if (r.type === 'choice') return r.opts[v];
  return r.fmt ? r.fmt(v) : String(v);
}

// ---------- screens ----------
const SCREENS = {
  main: {
    hints: [['↑↓', 'Выбор'], ['Enter', 'Выбрать']],
    onBack() { /* the root menu has nowhere to go back to */ },
    build(s) {
      // the interlude and the lighthouse are playable chapters too, just not listed in «Главы»
      const cur = Game.currentId && CHAPTER_META[Game.currentId] && CHAPTERS[Game.currentId] ? Game.currentId : null;
      const save = loadSave();
      const has = !!cur && (cur !== 'prologue' || Object.keys(Game.state.flags).length > 0);
      const species = Object.keys(Game.state.journal).filter((k) => Game.state.journal[k] && Game.state.journal[k].size).length;
      const open = Game.unlocked.length;
      const items = [];
      if (has) items.push({ id: 'btnContinue', label: 'Продолжить', sub: `${CHAPTER_META[cur].eyebrow.split(' · ')[0]} · ${CHAPTER_META[cur].title}`, snd: 'start', desc: `Глава «${CHAPTER_META[cur].title}» начнётся с начала — там, где игра сохранилась.`, act: () => startGame(cur, true) });
      items.push({ id: 'btnStart', label: has ? 'Новая игра' : 'Начать экспедицию', snd: false, desc: 'Пролог. Станция ORIGO «Порог», 04:40, южная часть Тихого океана.', act: newGame });
      items.push({ id: 'btnChapters', label: 'Главы', desc: `Открыто глав: ${open} из ${CHAPTER_ORDER.length}. Любую открытую главу можно переиграть.`, act: () => UI.push('chapters') });
      if (species) items.push({ id: 'btnJournalMenu', label: 'Полевой журнал', desc: `Видов в журнале: ${species}. Всё, что экспедиция узнала о животных острова.`, act: () => UI.openJournal('menu') });
      items.push({ id: 'btnSettings', label: 'Настройки', desc: 'Графика, звук, управление, субтитры.', act: () => UI.push('settings') });
      items.push({ id: 'btnCredits', label: 'Авторы', desc: 'Кто сделал UMBRA.', act: () => UI.push('credits') });
      const card = has
        ? `<div class="eyebrow">Последнее сохранение</div><div class="mc-title">${esc(CHAPTER_META[cur].title)}</div><div class="mc-sub">${esc(CHAPTER_META[cur].eyebrow)}</div>
           ${CHAPTER_META[cur].text ? `<p>${esc(CHAPTER_META[cur].text.split('\n')[0])}</p>` : ''}${pipsHtml(CHAPTER_META[cur].dna)}<div class="mc-meta">${save && save.t ? `Сохранено ${esc(fmtSaved(save.t))}` : ''}${species ? ` · видов в журнале: ${species}` : ''}</div>`
        : `<div class="eyebrow">Экспедиция D-05</div><p class="mc-blurb">Остров, которого нет на картах. Пять видов. Пять образцов живой ДНК. И вопрос, который никто не задал вслух: зачем?</p>`;
      s.el.innerHTML = `<nav class="mlist" aria-label="Главное меню">${menuItems(items)}</nav><p class="mdesc" data-desc-out></p><aside class="mcard">${card}</aside>`;
      bindItems(s, items);
    },
  },

  pause: {
    hints: [['↑↓', 'Выбор'], ['Enter', 'Выбрать'], ['Esc', 'Вернуться в игру']],
    onBack() { setPaused(false); },
    build(s) {
      const items = [{ id: 'btnResume', label: 'Продолжить', desc: 'Вернуться в игру.', act: () => setPaused(false) }];
      if (Game.ctx && Game.ctx.restore) items.push({ id: 'btnRestartCp', label: 'Контрольная точка', desc: 'Начать заново с последней контрольной точки этой главы.', act: () => { setPaused(false); Game.fail('Контрольная точка', '', () => Game.ctx.restore()); } });
      items.push({ id: 'btnPJournal', label: 'Полевой журнал', desc: 'Всё, что вы узнали о видах острова.', act: () => UI.openJournal('pause') });
      items.push({ id: 'btnPSettings', label: 'Настройки', desc: 'Графика, звук, управление, субтитры.', act: () => UI.push('settings') });
      items.push({ id: 'btnMenu', label: 'Главное меню', desc: 'Выйти в главное меню. «Продолжить» начнёт эту главу с начала.', act: toMainMenu });
      const obj = Guide.title;
      const card = `${obj && obj !== '…' ? `<div class="eyebrow">Текущая цель</div><div class="mc-obj">${esc(obj)}</div>${Guide.hint ? `<p>${esc(Guide.hint)}</p>` : ''}` : ''}
        <div class="eyebrow">Кейс с образцами</div>${pipsHtml(DNA_KEYS.filter((k) => Game.state.dna[k]), Game.state.dna.eva)}`;
      s.el.innerHTML = `<nav class="mlist" aria-label="Пауза">${menuItems(items)}</nav><p class="mdesc" data-desc-out></p><aside class="mcard pause">${card}</aside>`;
      bindItems(s, items);
    },
  },

  chapters: {
    hints: [['↑↓', 'Глава'], ['Enter', 'Начать'], ['Esc', 'Назад']],
    build(s) {
      const rows = CHAPTER_ORDER.map((id) => {
        const m = CHAPTER_META[id], open = Game.unlocked.includes(id);
        return `<button class="crow${open ? '' : ' locked'}" data-nav data-id="${id}" aria-disabled="${!open}"><span class="cn">${esc(m.eyebrow.split(' · ')[0])}</span><span class="ct">${open ? esc(m.title) : 'Закрыто'}</span>${open ? '' : ICON.lock}</button>`;
      }).join('');
      s.el.innerHTML = `${screenHead('Главы')}<div class="chwrap"><div class="clist">${rows}</div><div class="cdet" aria-live="polite"></div></div>`;
      const det = s.el.querySelector('.cdet');
      const show = (id) => {
        if (s.sel === id) return;
        s.sel = id;
        const m = CHAPTER_META[id], open = Game.unlocked.includes(id);
        det.innerHTML = open
          ? `<div class="cnum" aria-hidden="true">${ROMAN[id]}</div><div class="eyebrow">${esc(m.eyebrow)}</div><h3>${esc(m.title)}</h3><p>${esc(m.text || '')}</p>
             <div class="cdna"><span class="label">Образцы в кейсе на старте</span>${pipsHtml(m.dna)}</div><button class="btn primary" id="btnChStart">Начать главу</button>`
          : `<div class="cnum" aria-hidden="true">${ROMAN[id]}</div><div class="eyebrow">${esc(m.eyebrow.split(' · ')[0])}</div><h3 class="locked">${ICON.lock} Закрыто</h3><p>Эта глава откроется, когда экспедиция до неё дойдёт.</p>`;
        det.classList.remove('in'); void det.offsetWidth; det.classList.add('in');
        const b = det.querySelector('#btnChStart');
        if (b) b.onclick = () => { Sound.ui('start'); startGame(id, true); };
      };
      s.el.querySelectorAll('.crow').forEach((b) => {
        b.addEventListener('focus', () => show(b.dataset.id));
        b.onclick = () => {
          const id = b.dataset.id;
          if (!Game.unlocked.includes(id)) { Sound.ui('deny'); return; }
          // on touch the first tap only selects, so the description can be read first
          if (IS_TOUCH && s.tapped !== id) { s.tapped = id; show(id); return; }
          Sound.ui('start'); startGame(id, true);
        };
      });
      const start = Game.currentId && Game.unlocked.includes(Game.currentId) ? Game.currentId : 'prologue';
      s.startFocus = s.el.querySelector(`.crow[data-id="${start}"]`);
      show(start);
    },
  },

  settings: {
    hints: [['↑↓', 'Параметр'], ['←→', 'Изменить'], ['Q E', 'Вкладка'], ['R', 'Сбросить'], ['Esc', 'Назад']],
    build(s) {
      s.tab = s.tab || 0;
      s.el.innerHTML = `${screenHead('Настройки')}<div class="tabs" role="tablist">${IS_TOUCH ? '' : '<kbd>Q</kbd>'}${SET_TABS.map((t, i) => `<button role="tab" data-tab="${i}">${t.name}</button>`).join('')}${IS_TOUCH ? '' : '<kbd>E</kbd>'}<button class="linkbtn" id="btnReset">Сбросить</button></div>
        <div class="setwrap"><div class="rows"></div><aside class="sinfo" aria-live="polite"></aside></div>`;
      s.el.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { this.tab(s, +b.dataset.tab); }; });
      s.el.querySelector('#btnReset').onclick = () => this.reset(s);
      this.tab(s, s.tab, true);
    },
    tab(s, i, quiet) {
      s.tab = (i + SET_TABS.length) % SET_TABS.length;
      if (!quiet) Sound.ui('tab');
      s.el.querySelectorAll('[data-tab]').forEach((b) => { const on = +b.dataset.tab === s.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      const box = s.el.querySelector('.rows');
      const t = SET_TABS[s.tab];
      const rows = t.rows.filter((r) => !(r.hide && r.hide()));
      box.innerHTML = rows.map((r, n) => `<div class="srow" data-nav tabindex="0" data-n="${n}" role="${r.type === 'slider' ? 'slider' : r.type === 'toggle' ? 'switch' : 'listbox'}" aria-label="${esc(r.label)}"><span class="sl">${esc(r.label)}</span><span class="sc"></span></div>`).join('');
      s.rows = rows;
      box.querySelectorAll('.srow').forEach((el) => {
        const r = rows[+el.dataset.n];
        this.paint(el, r);
        el.addEventListener('focus', () => this.info(s, r));
        el.addEventListener('click', (e) => {
          const a = e.target.closest('[data-d]');
          if (a) { this.adjust(el, r, +a.dataset.d); return; }
          if (r.type !== 'slider' && !e.target.closest('.track')) this.adjust(el, r, 1, true);
        });
        const tr = el.querySelector('.track');
        if (tr) {
          const drag = (e) => { const b = tr.getBoundingClientRect(); const k = clamp((e.clientX - b.left) / b.width, 0, 1); const v = Math.round((r.min + k * (r.max - r.min)) / r.step) * r.step; if (v !== rowValue(r)) { rowSet(r, v); this.paint(el, r); this.info(s, r); Sound.ui('tick'); } };
          tr.addEventListener('pointerdown', (e) => { e.preventDefault(); el.focus({ preventScroll: true }); tr.setPointerCapture(e.pointerId); drag(e); tr.onpointermove = drag; });
          tr.addEventListener('pointerup', () => { tr.onpointermove = null; });
          tr.addEventListener('pointercancel', () => { tr.onpointermove = null; });
        }
      });
      if (!quiet) UI.focus(null, s);
      this.info(s, rows[0]);
    },
    // builds the control once, then only updates it: a slider being dragged must keep its element
    paint(el, r) {
      const v = rowValue(r), c = el.querySelector('.sc');
      if (r.type === 'slider') {
        const k = (v - r.min) / (r.max - r.min), pc = (k * 100).toFixed(1) + '%';
        if (!c.firstChild) c.innerHTML = '<button class="arr" data-d="-1" tabindex="-1" aria-label="Меньше">‹</button><span class="track"><i></i><b></b></span><button class="arr" data-d="1" tabindex="-1" aria-label="Больше">›</button><span class="val"></span>';
        c.querySelector('.track i').style.width = pc; c.querySelector('.track b').style.left = pc;
        c.querySelector('.val').textContent = rowText(r, v);
        el.setAttribute('aria-valuemin', r.min); el.setAttribute('aria-valuemax', r.max); el.setAttribute('aria-valuenow', v); el.setAttribute('aria-valuetext', rowText(r, v));
      } else {
        const n = r.type === 'toggle' ? 2 : r.opts.length, i = r.type === 'toggle' ? (v ? 1 : 0) : v;
        if (!c.firstChild) c.innerHTML = `<button class="arr" data-d="-1" tabindex="-1" aria-label="Назад">‹</button><span class="cv"><span class="cvt"></span><span class="seg">${'<i></i>'.repeat(n)}</span></span><button class="arr" data-d="1" tabindex="-1" aria-label="Вперёд">›</button>`;
        c.querySelector('.cvt').textContent = rowText(r, v);
        c.querySelectorAll('.seg i').forEach((x, j) => x.classList.toggle('on', j === i));
        c.classList.toggle('is-on', r.type === 'toggle' && !!v);
        if (r.type === 'toggle') el.setAttribute('aria-checked', !!v); else el.setAttribute('aria-valuetext', rowText(r, v));
      }
    },
    // d = ±1; wrap = true for Enter/click on a choice or toggle (cycles instead of stopping at the end)
    adjust(el, r, d, wrap) {
      const v = rowValue(r);
      let nv;
      if (r.type === 'toggle') nv = !v;
      else if (r.type === 'choice') { nv = v + d; if (nv < 0 || nv >= r.opts.length) { if (!wrap) { Sound.ui('deny'); return; } nv = (nv + r.opts.length) % r.opts.length; } }
      else { nv = clamp(v + d * r.step, r.min, r.max); if (nv === v) { Sound.ui('deny'); return; } }
      rowSet(r, nv);
      Sound.ui('tick');
      // fullscreen reports back asynchronously
      if (r.k === 'full') setTimeout(() => this.paint(el, r), 250);
      this.paint(el, r);
      this.info(UI.top(), r);
    },
    info(s, r) {
      const box = s.el.querySelector('.sinfo');
      if (!box || !r) return;
      let extra = '';
      if (r.preview === 'bright') {
        const m = Settings.brightMul();
        extra = `<div class="calib" style="filter:brightness(${m.toFixed(2)})"><span style="background:#0d0f0e"><i style="background:#161917"></i></span><span style="background:#0d0f0e"><i style="background:#262b28"></i></span><span style="background:#0d0f0e"><i style="background:#48504b"></i></span></div>`;
      } else if (r.preview === 'sub') {
        extra = `<div class="subprev ${['sub-s', 'sub-m', 'sub-l', 'sub-xl'][Settings.v.subSize]} ${Settings.v.subBg ? 'bg' : ''} ${Settings.v.subs ? '' : 'off'}"><div class="w">Лена</div><div class="t">Итан, левее. Нам туда.</div>${Settings.v.subs ? '' : '<div class="off-note">Субтитры выключены</div>'}</div>`;
      }
      const help = SET_TABS[s.tab].help ? `<div class="keys">${(IS_TOUCH ? TOUCH_HELP : KEYS_HELP).map(([k, t]) => `<div><kbd>${esc(k)}</kbd><span>${esc(t)}</span></div>`).join('')}</div>` : '';
      box.innerHTML = `<h3>${esc(r.label)}</h3><p>${esc(r.desc || '')}</p>${extra}${help}`;
    },
    reset(s) {
      UI.confirm({ eyebrow: 'Настройки', title: 'Сбросить настройки?', text: 'Звук, управление, субтитры и изображение вернутся к значениям по умолчанию. Качество графики не изменится.', yes: 'Сбросить', no: 'Отмена' })
        .then((ok) => { if (ok) { Settings.reset(); this.tab(s, s.tab, true); UI.focus(null, s); } });
    },
    key(s, e) {
      const k = e.code;
      if (k === 'KeyQ' || k === 'PageUp') { this.tab(s, s.tab - 1); return true; }
      if (k === 'KeyE' || k === 'PageDown') { this.tab(s, s.tab + 1); return true; }
      if (k === 'KeyR') { this.reset(s); return true; }
      const el = document.activeElement;
      if (!el || !el.classList.contains('srow')) return false;
      const r = s.rows[+el.dataset.n];
      if (k === 'ArrowLeft' || k === 'KeyA') { this.adjust(el, r, -1); return true; }
      if (k === 'ArrowRight' || k === 'KeyD') { this.adjust(el, r, 1); return true; }
      if (k === 'Enter' || k === 'Space') { if (r.type !== 'slider') this.adjust(el, r, 1, true); return true; }
      return false;
    },
  },

  credits: {
    hints: [['Esc', 'Назад']],
    onBack() { UI.pop(); if (UI.mode === 'menu' && !MenuMusic.on) MenuMusic.start(); },
    build(s) {
      const sec = CREDITS.map((c) => `<section><h4>${esc(c.head)}</h4>${(c.lines || []).map((l) => `<div>${l}</div>`).join('')}${c.cast ? `<div class="cast">${c.cast.map(([n, r]) => `<div><b>${esc(n)}</b><span>${esc(r)}</span></div>`).join('')}</div>` : ''}</section>`).join('');
      s.el.innerHTML = `${screenHead('Авторы')}<div class="roll" data-nav tabindex="0" aria-label="Титры"><div class="roll-in"><div class="r-logo">UMBRA</div><div class="r-sub">Expedition D-05</div>${sec}<div class="r-end">Спасибо, что играете.</div></div></div>`;
      const inner = s.el.querySelector('.roll-in');
      inner.addEventListener('animationend', () => { if (UI.top() === s) UI.back(); });
    },
  },

  confirm: {
    overlay: true,
    hints: [['←→', 'Выбор'], ['Enter', 'Подтвердить'], ['Esc', 'Отмена']],
    onBack(s) { UI.pop(); s.arg.resolve(false); },
    build(s) {
      const o = s.arg;
      s.el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(o.title)}"><div class="eyebrow">${esc(o.eyebrow || '')}</div><h3>${esc(o.title)}</h3><p>${esc(o.text || '')}</p>
        <div class="mbtns"><button class="btn primary" data-nav data-v="1">${esc(o.yes || 'Да')}</button><button class="btn" data-nav data-v="0">${esc(o.no || 'Отмена')}</button></div></div>`;
      s.el.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => { const v = b.dataset.v === '1'; UI.pop(!v); if (v) Sound.ui('ok'); o.resolve(v); }; });
      // destructive questions start on "cancel"
      s.startFocus = s.el.querySelector('[data-v="0"]');
    },
  },
};
function menuItems(items) {
  return items.map((it, i) => `<button class="mi" data-nav id="${it.id}" style="--i:${i}" data-desc="${esc(it.desc || '')}"><span class="mi-l">${esc(it.label)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('');
}
function bindItems(s, items) {
  for (const it of items) s.el.querySelector('#' + it.id).onclick = () => { if (it.snd !== false) Sound.ui(it.snd || 'ok'); it.act(); };
}
function screenHead(title) {
  return `<header class="shead"><button class="sback" data-back aria-label="Назад">${ICON.back}<span>Назад</span></button><h2>${esc(title)}</h2></header>`;
}

// ---------- the screen stack ----------
const UI = {
  stack: [], mode: 'menu', _quiet: false, journalFrom: null,
  top() { return this.stack[this.stack.length - 1] || null; },
  open(mode, root) {
    this.clear();
    this.mode = mode;
    const m = $('menu');
    m.hidden = false; m.classList.remove('leaving');
    m.classList.toggle('in-game', mode === 'pause');
    $('titleScr').hidden = true; $('uiMain').hidden = false; $('uiFoot').hidden = false;
    const brand = $('uiBrand');
    brand.classList.toggle('pause', mode === 'pause');
    if (mode === 'pause') {
      const meta = CHAPTER_META[Game.currentId] || { eyebrow: '', title: '' };
      $('uiBrandTop').textContent = 'Пауза'; $('uiBrandLogo').textContent = meta.title; $('uiBrandSub').textContent = meta.eyebrow;
    } else {
      $('uiBrandTop').textContent = 'ORIGO · Threshold Station · Site U'; $('uiBrandLogo').textContent = 'UMBRA'; $('uiBrandSub').textContent = 'Expedition D-05';
    }
    this.push(root);
  },
  hide() { this.clear(); $('menu').hidden = true; $('titleScr').hidden = true; },
  // fade the layer out while the screen goes black behind it
  leave() { $('menu').classList.add('leaving'); },
  clear() { this.stack.forEach((s) => s.el.remove()); this.stack = []; },
  push(name, arg) {
    const prev = this.top(), def = SCREENS[name];
    if (prev) { prev.focus = document.activeElement; if (def.overlay) prev.el.classList.add('under'); else prev.el.hidden = true; }
    const s = { name, arg, el: document.createElement('div') };
    s.el.className = 'scr scr-' + name + (def.overlay ? ' overlayed' : '');
    $('uiScreens').appendChild(s.el);
    this.stack.push(s);
    def.build.call(def, s);
    s.el.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => this.back(); });
    this._chrome();
    this.focus(s.startFocus || null, s);
    return s;
  },
  pop(sound = true) {
    const s = this.stack.pop();
    if (!s) return;
    s.el.remove();
    const p = this.top();
    if (p) {
      p.el.hidden = false; p.el.classList.remove('under');
      this._chrome();
      this.focus(p.focus && p.el.contains(p.focus) ? p.focus : null, p);
    }
    if (sound) Sound.ui('back');
  },
  back() {
    const s = this.top();
    if (!s) return;
    const def = SCREENS[s.name];
    if (def.onBack) def.onBack.call(def, s); else this.pop();
  },
  confirm(o) { return new Promise((resolve) => this.push('confirm', { ...o, resolve })); },
  _chrome() {
    const s = this.top();
    const base = [...this.stack].reverse().find((x) => !SCREENS[x.name].overlay);
    const root = !!base && (base.name === 'main' || base.name === 'pause');
    $('uiBrand').hidden = !root;
    $('uiMain').classList.toggle('sub', !root);
    const hints = s ? SCREENS[s.name].hints : [];
    $('uiHints').innerHTML = hints.map(([k, t]) => (k === 'Esc' ? `<button class="hint" data-back-hint><kbd>${k}</kbd>${t}</button>` : `<span class="hint"><kbd>${k}</kbd>${t}</span>`)).join('');
    const hb = $('uiHints').querySelector('[data-back-hint]');
    if (hb) hb.onclick = () => this.back();
  },
  navs(s = this.top()) { return s ? [...s.el.querySelectorAll('[data-nav]')].filter((e) => e.offsetParent !== null) : []; },
  focus(el, s = this.top()) {
    el = el || this.navs(s)[0];
    if (!el) return;
    this._quiet = true; el.focus({ preventScroll: true }); this._quiet = false;
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  },
  move(d) {
    const list = this.navs();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const j = i < 0 ? 0 : (i + d + list.length) % list.length;
    list[j].focus({ preventScroll: true });
    if (list[j].scrollIntoView) list[j].scrollIntoView({ block: 'nearest' });
  },

  // ---------- title screen ----------
  title() {
    this.clear();
    const m = $('menu');
    m.hidden = false; m.classList.remove('in-game', 'leaving');
    $('titleScr').hidden = false; $('uiMain').hidden = true; $('uiFoot').hidden = true;
    $('tPress').textContent = IS_TOUCH ? 'Коснитесь экрана' : 'Нажмите любую клавишу';
    const go = (e) => {
      // a chapter started some other way (the debug API) retires the title screen silently
      if ($('titleScr').hidden) { window.removeEventListener('keydown', go, true); m.removeEventListener('pointerdown', go); return; }
      if (e && e.type === 'keydown' && /^(F\d+|Alt|Control|Meta|Shift|OS)/.test(e.key)) return;
      window.removeEventListener('keydown', go, true); m.removeEventListener('pointerdown', go);
      if (e) { e.preventDefault(); e.stopPropagation(); }
      Sound.init(); Settings.apply(); Sound.ui('title'); MenuMusic.start();
      $('titleScr').classList.add('out');
      setTimeout(() => { $('titleScr').classList.remove('out'); this.open('menu', 'main'); }, 520);
    };
    window.addEventListener('keydown', go, true);
    m.addEventListener('pointerdown', go);
  },

  // ---------- journal on top of the menu, the pause menu or the game ----------
  openJournal(from) {
    this.journalFrom = from;
    $('uiFoot').hidden = true;
    Journal.open();
    this._quiet = true; $('btnJournalClose').focus({ preventScroll: true }); this._quiet = false;
  },
  closeJournal() {
    $('journal').hidden = true;
    const from = this.journalFrom;
    this.journalFrom = null;
    if (from === 'game') { Game.paused = false; HUD.resumeRadio(); return; }
    const s = this.top();
    if (s) { $('uiFoot').hidden = false; this.focus(s.el.querySelector('#btnJournalMenu, #btnPJournal'), s); }
    Sound.ui('back');
  },

  // ---------- keyboard ----------
  scope() {
    if (!$('journal').hidden) return 'journal';
    if (!$('choice').hidden) return 'choice';
    if (!$('menu').hidden && !$('titleScr').hidden) return null; // the title screen listens for itself
    if (!$('menu').hidden && this.stack.length && !$('menu').classList.contains('leaving')) return 'ui';
    return null;
  },
  onKey(e) {
    const scope = this.scope();
    if (!scope) return;
    const k = e.code;
    const up = k === 'ArrowUp' || k === 'KeyW', down = k === 'ArrowDown' || k === 'KeyS';
    let used = false;
    if (scope === 'journal') {
      if (k === 'Escape' || k === 'KeyJ' || k === 'Backspace' || k === 'Enter') { this.closeJournal(); used = true; }
      else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'KeyA' || k === 'KeyD' || k === 'KeyQ' || k === 'KeyE') {
        const tabs = [...$('jTabs').querySelectorAll('button')];
        const i = tabs.findIndex((b) => b.classList.contains('on'));
        const d = k === 'ArrowLeft' || k === 'KeyA' || k === 'KeyQ' ? -1 : 1;
        if (tabs.length > 1) { tabs[(i + d + tabs.length) % tabs.length].click(); Sound.ui('tab'); }
        used = true;
      }
    } else if (scope === 'choice') {
      const btns = [...$('choiceBtns').querySelectorAll('button')].filter((b) => !b.disabled);
      const i = btns.indexOf(document.activeElement);
      if (up || down) { const n = btns[i < 0 ? 0 : (i + (down ? 1 : -1) + btns.length) % btns.length]; if (n) n.focus(); used = true; }
      else if (k === 'Enter' || k === 'Space') {
        if (i < 0) { if (btns[0]) btns[0].focus(); }
        else {
          // the power panel re-renders its buttons on every click: keep the focus on the same row
          const all = [...$('choiceBtns').querySelectorAll('button')], idx = all.indexOf(btns[i]);
          btns[i].click();
          setTimeout(() => { if (!$('choice').hidden) { const b = $('choiceBtns').querySelectorAll('button')[idx]; if (b) b.focus({ preventScroll: true }); } }, 0);
        }
        used = true;
      } else if (k === 'Escape') used = true;
    } else {
      const s = this.top(), def = SCREENS[s.name];
      if (def.key && def.key.call(def, s, e)) used = true;
      else if (up || down) { this.move(down ? 1 : -1); used = true; }
      else if (s.name === 'confirm' && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'KeyA' || k === 'KeyD')) { this.move(k === 'ArrowRight' || k === 'KeyD' ? 1 : -1); used = true; }
      else if (k === 'Enter' || k === 'Space') {
        const a = document.activeElement;
        if (a && s.el.contains(a) && a.matches('[data-nav]')) a.click(); else this.focus(null, s);
        used = true;
      } else if (k === 'Escape' || k === 'Backspace' || (k === 'KeyP' && s.name === 'pause')) { this.back(); used = true; }
    }
    if (used) { e.preventDefault(); e.stopPropagation(); }
  },
};

window.addEventListener('keydown', (e) => UI.onKey(e), true);
// moving the mouse moves the focus, so mouse and keyboard never disagree about the selection.
// pointermove, not pointerover: a screen that opens under a resting cursor must keep its own default
$('menu').addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || (!e.movementX && !e.movementY)) return;
  const t = e.target.closest('[data-nav]');
  if (t && t !== document.activeElement && UI.top() && UI.top().el.contains(t)) t.focus({ preventScroll: true });
});
$('menu').addEventListener('focusin', (e) => {
  const t = e.target;
  if (!UI._quiet && t.matches('[data-nav]')) Sound.ui('move');
  const scr = t.closest('.scr');
  const out = scr && scr.querySelector('[data-desc-out]');
  if (out && t.dataset.desc !== undefined) { out.textContent = t.dataset.desc; out.classList.remove('in'); void out.offsetWidth; out.classList.add('in'); }
});
$('btnJournalClose').onclick = () => UI.closeJournal();
document.addEventListener('fullscreenchange', () => {
  const s = UI.top();
  if (!s || s.name !== 'settings') return;
  s.el.querySelectorAll('.srow').forEach((el) => { const r = s.rows[+el.dataset.n]; if (r.k === 'full') SCREENS.settings.paint(el, r); });
});

// ---------- flows ----------
function newGame() {
  const cur = Game.currentId;
  const has = !!cur && (cur !== 'prologue' || Object.keys(Game.state.flags).length > 0);
  const go = () => { Sound.ui('start'); resetState(); Game.unlocked = Game.unlocked.length ? Game.unlocked : ['prologue']; startGame('prologue'); };
  if (!has) { go(); return; }
  Sound.ui('ok');
  UI.confirm({ eyebrow: 'Новая игра', title: 'Начать экспедицию заново?', text: `Текущее прохождение (${CHAPTER_META[cur].eyebrow.split(' · ')[0]} · ${CHAPTER_META[cur].title}) будет перезаписано. Открытые главы останутся доступны в меню «Главы».`, yes: 'Начать заново', no: 'Отмена' })
    .then((ok) => { if (ok) go(); });
}
function toMainMenu() {
  UI.confirm({ eyebrow: 'Пауза', title: 'Выйти в главное меню?', text: 'Игра сохранилась в начале этой главы. «Продолжить» в главном меню начнёт её с начала.', yes: 'Выйти', no: 'Остаться' })
    .then((ok) => {
      if (!ok) return;
      UI.leave();
      HUD.fade(1, 0.6).then(() => { Game.paused = false; Sound.pauseMuffle(false); openMenu(); });
    });
}
