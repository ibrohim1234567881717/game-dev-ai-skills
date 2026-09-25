// ============================================================
// 15-hud.js — HUD, radio, prompts, case, journal, DNA flow
// ============================================================
const HUD = {
  _promptSet: false, _radioQ: [], _radioBusy: false, _bigTimer: null, _toastTimer: null,
  show(on) { $('hud').hidden = !on; $('touch').hidden = !(on && IS_TOUCH); },
  objective(text, sub) {
    $('objective').hidden = text === '…'; // no placeholder panel while a chapter sets up
    const el = $('objText');
    el.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    const o = $('objective');
    o.classList.remove('fresh'); void o.offsetWidth; o.classList.add('fresh');
    Guide.onObjective(text, sub);
  },
  speaking: null, // { key, radio } while a subtitle line is up
  beginFrame() { this._promptSet = false; },
  endFrame() { if (!this._promptSet) $('prompt').hidden = true; },
  prompt(text, key = 'E', progress = null, warn = false) {
    this._promptSet = true;
    const p = $('prompt');
    p.hidden = false;
    p.classList.toggle('warn', !!warn);
    $('promptKey').textContent = key;
    $('promptKey').style.display = key ? '' : 'none';
    $('promptText').textContent = text;
    const bar = $('promptBar');
    bar.classList.toggle('on', progress !== null);
    if (progress !== null) bar.firstElementChild.style.width = (clamp(progress, 0, 1) * 100).toFixed(1) + '%';
    $('tbInteract').classList.toggle('hot', key === 'E');
  },
  // radio lines: [{who, text, dur}] — returns promise when the batch finishes
  say(lines, interrupt = false) {
    if (!Array.isArray(lines)) lines = [lines];
    if (typeof Cine !== 'undefined' && Cine.active) interrupt = true;
    if (interrupt) {
      clearTimeout(this._radioTimer);
      Voice.stop();
      if (this._radioCur && this._radioCur.done) this._radioCur.done();
      for (const q of this._radioQ) if (q.done) q.done();
      this._radioQ.length = 0;
      this._radioBusy = false;
    }
    return new Promise((resolve) => {
      lines.forEach((l, i) => this._radioQ.push({ ...l, done: i === lines.length - 1 ? resolve : null }));
      if (!this._radioBusy) this._nextRadio();
    });
  },
  _nextRadio() {
    const r = $('radio');
    const l = this._radioQ.shift();
    this._radioCur = l || null;
    if (!l) { this._radioBusy = false; r.hidden = true; this.speaking = null; return; }
    this._radioBusy = true;
    r.hidden = false;
    $('radioWho').textContent = l.who || '';
    $('radioWho').className = l.who && l.who.startsWith('[') ? 'sys' : '';
    $('radioText').innerHTML = l.text;
    const radio = isRadioLine(l.who);
    this.speaking = { key: speakerKey(l.who), radio, until: Game.time + 99 };
    let dur = l.dur ?? clamp(1.6 + l.text.length * 0.055, 2.2, 7.5);
    const v = Voice.lookup(l.who, l.text);
    if (v && Sound.ctx && !Game.muted) { Voice.play(v, radio); dur = v.d + 0.35; }
    this._radioTimer = setTimeout(() => { const d = l.done; l.done = null; if (d) d(); this._nextRadio(); }, dur * 1000);
  },
  clearRadio() {
    clearTimeout(this._radioTimer);
    Voice.stop();
    this.speaking = null;
    if (this._radioCur && this._radioCur.done) this._radioCur.done();
    for (const q of this._radioQ) if (q.done) q.done();
    this._radioQ.length = 0; this._radioBusy = false; this._radioCur = null; $('radio').hidden = true;
  },
  radioBusy() { return this._radioBusy; },
  big(title, sub = '', cls = '', dur = 3.2) {
    const b = $('big');
    b.className = cls;
    $('bigTitle').textContent = title;
    $('bigSub').textContent = sub;
    b.hidden = false;
    void b.offsetWidth; b.classList.add('show');
    clearTimeout(this._bigTimer);
    if (dur > 0) this._bigTimer = setTimeout(() => { b.hidden = true; }, dur * 1000);
  },
  hideBig() { $('big').hidden = true; },
  toast(text, dur = 2.6) {
    const t = $('toast'); t.innerHTML = text; t.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.hidden = true; }, dur * 1000);
  },
  noise(level) {
    const bars = $('noise').children;
    const n = level <= 0.1 ? 0 : level < 4 ? 1 : level < 10 ? 2 : 3;
    for (let i = 1; i < bars.length; i++) { bars[i].classList.toggle('on', i <= n); bars[i].classList.toggle('hot', n === 3); }
  },
  health(h) { const b = $('health').querySelectorAll('b'); b.forEach((el, i) => el.classList.toggle('off', i >= h)); },
  observe(p) {
    const o = $('observe');
    if (p === null) { o.hidden = true; return; }
    o.hidden = false;
    $('observeArc').style.strokeDashoffset = (100.5 * (1 - clamp(p, 0, 1))).toFixed(1);
  },
  danger(on) { $('danger').classList.toggle('on', !!on); },
  timer(text) { const t = $('timer'); if (text === null) { t.hidden = true; return; } t.hidden = false; t.textContent = text; },
  compass(yaw, markers) {
    // yaw: camera heading, 0 = looking north (-z). markers: [{x,z,label,cls}] relative to player
    const strip = $('compassStrip');
    const w = strip.clientWidth || 300;
    const span = Math.PI * 0.95;
    let html = '';
    const cards = [['С', 0], ['СВ', Math.PI / 4], ['В', Math.PI / 2], ['ЮВ', 3 * Math.PI / 4], ['Ю', Math.PI], ['ЮЗ', -3 * Math.PI / 4], ['З', -Math.PI / 2], ['СЗ', -Math.PI / 4]];
    for (const [n, a] of cards) {
      const d = wrapAngle(a - yaw);
      if (Math.abs(d) < span / 2) html += `<span class="${n.length === 1 ? 'card' : ''}" style="left:${(50 + (d / span) * 100).toFixed(1)}%">${n}</span>`;
    }
    for (const m of markers || []) {
      const d = wrapAngle(m.bearing - yaw);
      const x = clamp(50 + (d / span) * 100, 4, 96);
      html += `<span class="mk ${m.cls || ''}" style="left:${x.toFixed(1)}%">${m.label}</span>`;
    }
    strip.innerHTML = html;
  },
  letterbox(on) { $('letterbox').classList.toggle('on', !!on); document.body.classList.toggle('cine', !!on); },
  fade(to, dur = 1) {
    const f = $('fade');
    f.style.transition = `opacity ${dur}s ease`;
    f.style.opacity = to;
    return wait(dur);
  },
  flash(intensity = 0.8, dur = 0.25) {
    const f = $('flash');
    f.style.transition = 'none'; f.style.opacity = intensity;
    requestAnimationFrame(() => { f.style.transition = `opacity ${dur}s ease-out`; f.style.opacity = 0; });
  },
  viewfinder(mode, label = '') {
    const v = $('viewfinder');
    v.hidden = !mode;
    v.classList.toggle('aim', mode === 'aim');
    $('vfLabel').textContent = label;
    $('tbShoot').hidden = !mode;
    $('tbShoot').textContent = mode === 'aim' ? 'Выстрел' : 'Снимок';
  },
  throwBtn(on) { $('tbThrow').hidden = !on; },
  renderCase() {
    const s = Game.state.dna;
    const codes = [['tri', 'TRI'], ['rap', 'RAP'], ['spi', 'SPI'], ['pte', 'PTE'], ['rex', 'REX']];
    let html = codes.map(([k, c]) => `<div class="slot ${s[k] ? 'ok' : ''}" id="slot_${k}"><span>${c}</span></div>`).join('');
    html += `<div class="slot ${s.eva ? 'eva' : 'na'}" id="slot_eva"><span>${s.eva ? 'EVA' : 'N/A'}</span></div>`;
    $('caseSlots').innerHTML = html;
    $('caseCount').textContent = `${dnaCount()}/5`;
    $('case').hidden = Game.currentId === 'prologue' && !Game.state.flags.hasCase;
    if (Game.player) Game.player.setCaseLights(s);
  },
  journalChip(sp) {
    const c = $('journalChip');
    if (!sp) { c.hidden = true; return; }
    c.hidden = false;
    c.innerHTML = `${SPECIES[sp].name} <b>${Journal.pct(sp)}%</b>`;
  },
};

// ---------- species & journal ----------
const SPECIES = {
  tri: {
    name: 'TRICERATOPS', ru: 'Трицератопс', era: 'Поздний мел · 68–66 млн лет назад · травоядное-«садовник»',
    items: [
      ['seen', 'Обнаружение', 10], ['observe', 'Наблюдение 20 с', 10], ['photo', 'Фото ★★', 10],
      ['t_print', 'След: отпечатки', 5], ['t_dung', 'След: помёт', 5], ['t_cycad', 'След: объеденные саговники', 5], ['t_blood', 'След: кровь', 5],
      ['b_graze', 'Поведение: выпас', 6], ['b_calves', 'Поведение: детёныши в центре', 6], ['b_alarm', 'Поведение: тревога стада', 6], ['b_duel', 'Поведение: поединок самцов', 6], ['b_elder', 'Особь: Старуха', 6],
      ['dna', 'ДНК', 20],
    ],
    notes: [
      [25, 'Стадо держится вокруг старой самки со сломанным рогом. Лена назвала её Старухой — так она подписана в записях D-04.'],
      [50, 'Восприятие: зрение средней дальности, слух хороший, нюх — по ветру до 30 м. Неподвижного человека в папоротнике видят плохо.'],
      [75, 'Слабость: мать атакует, если подойти к детёнышу ближе 12 м. Держитесь от молодняка дальше, чем от взрослых.'],
      [100, 'Архив Варна: «Садовники. Там, где прошло стадо, через год растёт другой лес. Без них остров зарастёт за десять лет».'],
    ],
  },
  bra: {
    name: 'BRACHIOSAURUS', ru: 'Брахиозавр', era: 'Поздняя юра · 154–150 млн лет назад · на острове — «вне эпохи»',
    items: [['seen', 'Обнаружение', 30], ['photo', 'Фото ★★', 30], ['b_drink', 'Поведение: питьё', 40]],
    notes: [[50, 'Юрский вид среди меловых. Лена: «Варн собирал не музей, а работающую экосистему. Ему было всё равно, из какой эпохи шестерёнка».']],
  },
  rap: {
    name: 'VELOCIRAPTOR', ru: 'Велоцираптор (реконструкция Варна)', era: 'Поздний мел · 75–71 млн лет назад · стайный хищник',
    items: [['seen', 'Обнаружение', 15], ['photo', 'Фото ★★', 15], ['t_feather', 'След: перья', 10], ['t_claw', 'След: царапины', 10], ['b_listen', 'Поведение: идёт на шум', 15], ['b_learn', 'Поведение: не верит повтору', 15], ['dna', 'ДНК', 20]],
    notes: [
      [25, 'Это не настоящий велоцираптор — тот был размером с индейку. Варн называл виды по ближайшей окаменелости, а пробелы генома заполнял сам.'],
      [50, 'Слух отличный, зрение хорошее при свете. В темноте полагаются на звук.'],
      [75, 'Слабость: приманка в одной и той же зоне второй раз работает вдвое хуже. Меняйте места.'],
    ],
  },
  spi: {
    name: 'SPINOSAURUS', ru: 'Спинозавр · Харон', era: 'Ранний мел · 99–93 млн лет назад · водный хищник',
    items: [['seen', 'Обнаружение', 20], ['photo', 'Фото ★★', 20], ['t_bones', 'След: рыбьи кости', 10], ['b_fish', 'Поведение: рыбалка у водосброса', 20], ['dna', 'ДНК', 30]],
    notes: [[50, 'Харон почти не выходит далеко на сушу. Дальше шести метров от воды он вас не достанет.']],
  },
  pte: {
    name: 'PTERANODON', ru: 'Птеранодон', era: 'Поздний мел · 86–84 млн лет назад · воздушное звено',
    items: [['seen', 'Обнаружение', 20], ['photo', 'Фото ★★', 20], ['b_sentinel', 'Поведение: часовые', 15], ['b_care', 'Поведение: забота о птенце', 15], ['dna', 'ДНК', 30]],
    notes: [[50, 'Когтей для захвата у них нет. Опасность — удар крылом на узкой тропе.']],
  },
  rex: {
    name: 'TYRANNOSAURUS REX', ru: 'Тираннозавр · Королева', era: 'Поздний мел · 68–66 млн лет назад · высший хищник',
    items: [['seen', 'Обнаружение', 20], ['photo', 'Фото ★★', 20], ['t_prints', 'След: отпечатки', 10], ['b_scent', 'Поведение: охота по запаху', 20], ['dna', 'ДНК', 30]],
    notes: [[50, 'Чует по ветру на 200 м. Идите против ветра, и она вас не найдёт — пока не увидит.']],
  },
  eva: {
    name: 'EVA-0', ru: 'Вид не в реестре', era: 'Не совпадает ни с одной окаменелостью · 1987',
    items: [['seen', 'Обнаружение', 25], ['t_prints', 'След: четырёхпалый отпечаток', 25], ['b_sound', 'Поведение: охота на звук', 25], ['dna', 'ДНК (шестой образец)', 25]],
    notes: [[50, 'Слепая. Не реагирует на свет фонаря — только на звук. Капель в пещере глушит шаги.']],
  },
};
const Journal = {
  add(sp, id, silent = false) {
    const j = (Game.state.journal[sp] ||= new Set());
    if (j.has(id)) return false;
    const item = SPECIES[sp].items.find((i) => i[0] === id);
    if (!item) return false;
    j.add(id);
    if (!silent) {
      HUD.toast(`ЖУРНАЛ · ${SPECIES[sp].name} <b style="color:var(--amber)">+${item[2]}%</b> · ${item[1]}`);
      Sound.sfx('ping', 0.35);
      setTimeout(() => Tutorial.show('journal', IS_TOUCH ? 'Кнопка <kbd>Журнал</kbd> — всё, что вы узнали о видах' : '<kbd>J</kbd> — полевой журнал: всё, что вы узнали о видах', () => !$('journal').hidden, { max: 10 }), 2600);
    }
    HUD.journalChip(sp);
    Game.lastSpecies = sp;
    writeSave();
    return true;
  },
  has(sp, id) { return !!(Game.state.journal[sp] && Game.state.journal[sp].has(id)); },
  pct(sp) {
    const j = Game.state.journal[sp];
    if (!j) return 0;
    return SPECIES[sp].items.reduce((s, i) => s + (j.has(i[0]) ? i[2] : 0), 0);
  },
  open() {
    const known = Object.keys(SPECIES).filter((k) => Game.state.journal[k] && Game.state.journal[k].size);
    const tabs = $('jTabs'), body = $('jBody');
    if (!known.length) {
      tabs.innerHTML = '';
      body.innerHTML = '<p class="j-note locked">Журнал пуст. Сфотографируйте животное или найдите его следы, чтобы открыть страницу вида.</p>';
    } else {
      let cur = known.includes(Game.lastSpecies) ? Game.lastSpecies : known[0];
      const render = () => {
        tabs.innerHTML = known.map((k) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${SPECIES[k].name}</button>`).join('');
        tabs.querySelectorAll('button').forEach((b) => b.onclick = () => { cur = b.dataset.k; render(); });
        const sp = SPECIES[cur], j = Game.state.journal[cur], pct = this.pct(cur);
        const list = sp.items.map((i) => `<li class="${j.has(i[0]) ? 'got' : ''}"><span>${j.has(i[0]) ? '✓ ' : ''}${i[1]}</span><b>${i[2]}%</b></li>`).join('');
        const notes = sp.notes.map(([th, t]) => pct >= th ? `<p class="j-note">${t}</p>` : `<p class="j-note locked">Откроется на ${th}%</p>`).join('');
        const photos = Game.state.photos.filter((p) => p.sp === cur);
        const ph = photos.length ? `<div class="j-photos">${photos.map((p) => `<figure><img src="${p.src}" alt="Фото: ${sp.ru}"><figcaption>${'★'.repeat(p.stars)}${'☆'.repeat(3 - p.stars)} ${p.tag || ''}</figcaption></figure>`).join('')}</div>` : '';
        body.innerHTML = `<div class="j-head"><div><h3>${sp.name}</h3><div class="j-era">${sp.ru} · ${sp.era}</div></div><div class="j-pct">${pct}%</div></div><ul class="j-list">${list}</ul>${notes}${ph}`;
      };
      render();
    }
    $('journal').hidden = false;
  },
};

// ---------- DNA collection ----------
const DNA = {
  busy: false,
  async collect(key, ok, label) {
    if (this.busy) return false;
    this.busy = true;
    const slot = $('slot_' + key);
    HUD.toast('SAMPLE LOADED', 1);
    Sound.sfx('click');
    await wait(0.7);
    HUD.toast('SEALED', 1);
    Sound.sfx('lever', 0.6);
    await wait(0.6);
    if (slot) slot.classList.add('analyzing');
    HUD.toast('ANALYZING…', 3);
    for (let i = 0; i < 5; i++) { Sound.tone(600 + i * 90, 0.08, 'sine', 0.06); await wait(0.6); }
    if (slot) slot.classList.remove('analyzing');
    if (ok) {
      Game.state.dna[key] = true;
      HUD.renderCase();
      Sound.sfx('verified');
      if (key === 'eva') HUD.big(`${label} — VERIFIED`, 'SIXTH SLOT: ACTIVE', 'ark', 4);
      else HUD.big(`${label} DNA — VERIFIED`, `DNA COLLECTION: ${dnaCount()}/5`, 'ok', 4.5);
      writeSave();
    } else {
      if (slot) { slot.classList.add('bad'); setTimeout(() => slot.classList.remove('bad'), 1600); }
      Sound.sfx('rejected');
      HUD.big('SAMPLE REJECTED', 'NO VIABLE CELLS', 'bad', 3.2);
    }
    this.busy = false;
    return ok;
  },
};
