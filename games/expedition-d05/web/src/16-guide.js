// ============================================================
// 16-guide.js — objectives, player guidance, contextual tutorials
//
// Guidance escalates only while the player makes no progress toward the
// current goal: first the world (lights, paths, companions walking there),
// then a companion's line (~25 s), then a small waypoint (~50 s).
// A chapter marks its goal in markers() with { goal: true }, optional
// { near } (arrival radius), { nudge } (a hand-written first hint) and
// { patient: true } (standing still is the task, e.g. observing).
// ============================================================
const _wpV = new THREE.Vector3();
const baseTitle = (t) => (t || '').replace(/\s*·\s*\d+\/\d+\s*$/, '').trim();

// companion hints by speaker; the direction is relative to the camera
const NUDGES = {
  lena: {
    ahead: [{ who: 'Лена', text: 'Итан, нам прямо. Не сворачивайте.' }, { who: 'Лена', text: 'Всё верно, Итан, идём дальше вперёд.' }],
    left: [{ who: 'Лена', text: 'Итан, левее. Нам туда.' }, { who: 'Лена', text: 'Возьмите левее, Итан.' }],
    right: [{ who: 'Лена', text: 'Итан, правее. Нам туда.' }, { who: 'Лена', text: 'Правее, Итан. Смотрите на компас.' }],
    behind: [{ who: 'Лена', text: 'Итан, мы уходим не туда. Разворачивайтесь.' }, { who: 'Лена', text: 'Нам в обратную сторону, Итан.' }],
  },
  halm: {
    ahead: [{ who: 'Хальм', text: 'Прямо, мистер Рид. Не тратьте время.' }],
    left: [{ who: 'Хальм', text: 'Левее, мистер Рид.' }],
    right: [{ who: 'Хальм', text: 'Правее, мистер Рид.' }],
    behind: [{ who: 'Хальм', text: 'Мистер Рид, вы идёте не туда.' }],
  },
  diego: {
    ahead: [{ who: 'Диего', text: 'Следопыт, прямо. Не зевай.' }],
    left: [{ who: 'Диего', text: 'Левее, Следопыт.' }],
    right: [{ who: 'Диего', text: 'Правее, Следопыт.' }],
    behind: [{ who: 'Диего', text: 'Эй, Следопыт. Нам в другую сторону.' }],
  },
  lucas: {
    ahead: [{ who: 'Лукас', text: 'Следопыт, прямо по курсу.' }],
    left: [{ who: 'Лукас', text: 'Левее, Следопыт. Штурман из тебя так себе.' }],
    right: [{ who: 'Лукас', text: 'Правее, Следопыт.' }],
    behind: [{ who: 'Лукас', text: 'Следопыт, разворот на сто восемьдесят.' }],
  },
  nora: {
    ahead: [{ who: 'Нора (интерком)', text: 'Мистер Рид, прямо перед вами.' }],
    left: [{ who: 'Нора (интерком)', text: 'Мистер Рид, левее.' }],
    right: [{ who: 'Нора (интерком)', text: 'Мистер Рид, правее.' }],
    behind: [{ who: 'Нора (интерком)', text: 'Мистер Рид, вам в другую сторону.' }],
  },
};

const Guide = {
  title: '', hint: '', setAt: 0, bestD: Infinity, stall: 0, nudges: 0, wpForce: 0, wpAuto: false, pending: null,
  goal: null, lastNudgeAt: -99, _bannerTimer: null,
  reset() {
    this.title = ''; this.hint = ''; this.pending = null; this.goal = null; this.wpForce = 0; this.wpAuto = false;
    this.bestD = Infinity; this.stall = 0; this.nudges = 0;
    $('objBanner').hidden = true; $('waypoint').hidden = true;
  },
  // HUD.objective(title, hint) routes here
  onObjective(title, hint) {
    const prev = this.title;
    const status = title === '…' || /^DNA COLLECTION/.test(title);
    const same = !!prev && baseTitle(prev) === baseTitle(title);
    const changed = title !== prev || (hint || '') !== this.hint;
    this.title = title; this.hint = hint || '';
    this.setAt = Game.time; this.bestD = Infinity; this.stall = 0; this.nudges = 0; this.wpAuto = false;
    $('objective').classList.remove('collapsed');
    if (status || !changed) return;
    this.banner(same ? 'Цель обновлена' : 'Новая цель', title);
    if (!same) this.wpForce = 5;
    if (Game.currentId === 'prologue' && !same && prev && prev !== '…') setTimeout(() => Tutorial.show('objective', IS_TOUCH ? 'Кнопка <kbd>Цель</kbd> — напомнить задачу' : '<kbd>Tab</kbd> — напомнить текущую цель', () => this._recalled, { max: 9 }), 3500);
  },
  banner(kind, title) {
    if (Cine.active || Game.loading || $('hud').hidden) { this.pending = [kind, title]; return; }
    this.pending = null;
    const b = $('objBanner');
    $('obKind').textContent = kind; $('obTitle').textContent = title;
    b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    Sound.sfx('ping', kind === 'Новая цель' ? 0.7 : 0.4);
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => { b.hidden = true; }, 3400);
  },
  recall() {
    if (!this.title || this.title === '…') return;
    this._recalled = true;
    $('objective').classList.remove('collapsed');
    const o = $('objective'); o.classList.remove('fresh'); void o.offsetWidth; o.classList.add('fresh');
    this.setAt = Game.time;
    this.wpForce = 6;
    Sound.sfx('ping', 0.3);
  },
  _speaker() {
    const g = Game.ctx && Game.ctx.guide;
    if (g === null) return null;
    const key = (g && g.key) || { prologue: 'nora', valley: 'lena', k4: 'lena', river: 'lena', peaks: 'lena', truth: 'lena', queen: 'lena', lighthouse: 'lena' }[Game.currentId];
    if (!key) return null;
    // in person when that character is close by, otherwise over the radio
    const w = Game.world, p = Game.player;
    let near = false;
    if (w && w.cast && p) for (const m of w.cast) if (m.userData.castKey === key && m.visible && dist2d(m.position.x, m.position.z, p.pos.x, p.pos.z) < 22) near = true;
    return { key, near, member: near ? w.cast.find((m) => m.userData.castKey === key) : null };
  },
  nudge(goal) {
    const sp = this._speaker();
    if (!sp || HUD.radioBusy()) return false;
    const p = Game.player;
    const bearing = Math.atan2(goal.x - p.pos.x, -(goal.z - p.pos.z));
    const rel = wrapAngle(bearing - Cam.heading());
    const dir = Math.abs(rel) < 0.45 ? 'ahead' : Math.abs(rel) > 2.3 ? 'behind' : rel < 0 ? 'left' : 'right';
    let line;
    if (goal.nudge && this.nudges === 0) line = { who: goal.nudgeWho || (sp.key === 'nora' ? 'Нора (интерком)' : CHARACTERS[sp.key] ? CHARACTERS[sp.key].short : ''), text: goal.nudge };
    else {
      const set = (NUDGES[sp.key] || NUDGES.lena)[dir];
      line = { ...set[this.nudges % set.length] };
    }
    if (!sp.near && sp.key !== 'nora' && !/\(/.test(line.who)) line.who += ' (рация)';
    HUD.say([line]);
    if (sp.member && sp.member.userData.companion) sp.member.userData.companion.gesture('point', goal);
    this.lastNudgeAt = Game.time;
    return true;
  },
  update(dt, markers) {
    if (this.pending && !Cine.active && !Game.loading && !$('hud').hidden) this.banner(...this.pending);
    if (Game.time - this.setAt > 16 && this.hint) $('objective').classList.add('collapsed');
    this.wpForce = Math.max(0, this.wpForce - dt);
    // current goal: nearest marker flagged as the goal
    const p = Game.player;
    let goal = null, gd = Infinity;
    for (const m of markers || []) if (m.goal) { const d = dist2d(p.pos.x, p.pos.z, m.x, m.z); if (d < gd) { gd = d; goal = m; } }
    this.goal = goal;
    const wp = $('waypoint');
    if (!goal) { wp.hidden = true; return; }
    const near = goal.near ?? 9;
    const busy = Cine.active || !Input.enabled || Cam.mode !== 'third' || DNA.busy || Interact.cur;
    if (gd < this.bestD - 5) { this.bestD = gd; this.stall = 0; this.wpAuto = false; }
    else if (gd < near || goal.patient) { this.stall = 0; this.wpAuto = false; }
    else if (!busy && !HUD.radioBusy()) this.stall += dt;
    if (this.stall > 25 && this.nudges === 0 && this.nudge(goal)) this.nudges = 1;
    if (this.stall > 50) { this.wpAuto = true; if (this.nudges === 1 && this.nudge(goal)) this.nudges = 2; }
    if (this.stall > 110 && this.nudges === 2 && this.nudge(goal)) this.nudges = 3;
    const show = (this.wpForce > 0 || this.wpAuto) && !Cine.active && Cam.mode === 'third' && gd > near * 0.6 && !$('hud').hidden;
    if (!show) { wp.hidden = true; return; }
    const gy = goal.y ?? (Game.world.groundH(goal.x, goal.z) + 2.2);
    _wpV.set(goal.x, gy, goal.z).project(camera);
    const W = window.innerWidth, H = window.innerHeight;
    let x = (_wpV.x * 0.5 + 0.5) * W, y = (-_wpV.y * 0.5 + 0.5) * H;
    const behind = _wpV.z > 1;
    if (behind) { x = W - x; y = H - 40; }
    const m = 36;
    const off = behind || x < m || x > W - m || y < m || y > H - m;
    x = clamp(x, m, W - m); y = clamp(y, m + 30, H - m - 60);
    wp.hidden = false;
    wp.classList.toggle('edge', off);
    wp.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
    $('wpDist').textContent = `${Math.round(gd)} м`;
  },
};

// ---------- contextual tutorials: one line, shown once per playthrough ----------
const Tutorial = {
  cur: null, queue: [],
  seen(id) { return !!(Game.state.flags.tut && Game.state.flags.tut[id]); },
  show(id, html, done, o = {}) {
    if (this.seen(id) || (this.cur && this.cur.id === id) || this.queue.some((q) => q.id === id)) return;
    // valid(): the hint only makes sense in some situation (sprint during the long walk); a queued
    // or open hint whose moment has passed is dropped unseen instead of appearing out of context
    const t = { id, html, done, valid: o.valid || null, t: 0, okT: 0, min: o.min ?? 1.4, max: o.max ?? 16 };
    if (this.cur) { this.queue.push(t); return; }
    this._open(t);
  },
  _open(t) {
    this.cur = t;
    const el = $('tutorial');
    el.innerHTML = t.html;
    el.hidden = false; el.classList.remove('done'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  },
  _close() {
    const t = this.cur;
    if (!t) return;
    (Game.state.flags.tut ||= {})[t.id] = true;
    writeSave();
    const el = $('tutorial');
    el.classList.add('done');
    this.cur = null;
    setTimeout(() => { if (!this.cur) el.hidden = true; }, 450);
  },
  update(dt) {
    const el = $('tutorial');
    if (!this.cur) {
      while (this.queue.length && this.queue[0].valid && !this.queue[0].valid()) this.queue.shift();
      if (this.queue.length && !Cine.active) this._open(this.queue.shift());
      return;
    }
    if (this.cur.valid && !this.cur.valid()) { this.cur = null; el.classList.add('done'); setTimeout(() => { if (!this.cur) el.hidden = true; }, 450); return; }
    if (Cine.active || Game.paused) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = '';
    const t = this.cur;
    t.t += dt;
    let ok = false;
    try { ok = !!(t.done && t.done()); } catch (e) { ok = false; }
    if (ok) t.okT += dt;
    if ((t.okT > 0.35 && t.t > t.min) || t.t > t.max) this._close();
  },
  reset() { this.cur = null; this.queue = []; $('tutorial').hidden = true; },
};
