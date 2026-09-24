// ============================================================
// 90-main.js — chapter manager, menu, loop
// ============================================================
const CHAPTER_META = {
  prologue: { eyebrow: 'Пролог', title: 'Порог', text: 'Станция ORIGO «Порог», 04:40. Южная часть Тихого океана.\nДо вылета на остров, которого нет ни на одной карте, — полтора часа.', dna: [] },
  valley: { eyebrow: 'Глава I · DNA 1/5', title: 'Долина', text: 'Триста сорок километров над океаном, стена облаков — и остров.\nПервая цель — трицератопсы. Карта старая. Верьте следам.', dna: [] },
  k4: { eyebrow: 'Глава II · DNA 2/5', title: 'Красный свет', text: 'В джунглях зациклен аварийный маяк с кодом «D-01».\nИсследовательский комплекс K-4. Электричества нет. Кто-то внутри всё ещё есть.', dna: ['tri'] },
  river: { eyebrow: 'Глава III · DNA 3/5', title: 'Тёмная вода', text: 'Болота и Великая река. Мара Линд из экспедиции D-04 называла здешнего хищника Хароном.\n«Никогда не стой на плотине, когда вода уходит».', dna: ['tri', 'rap'] },
  peaks: { eyebrow: 'Глава IV · DNA 4/5', title: 'Высота', text: 'Лагерь «Эхо» уничтожен. Диего пропал, уводя стаю.\nЕдинственный рабочий ретранслятор — на хребте, рядом с гнёздами птеранодонов.', dna: ['tri', 'rap', 'spi'] },
  truth: { eyebrow: 'Глава V · Правда', title: 'Лагерь Линд', text: 'Путь к территории T-Rex лежит через кальдеру.\nНа её краю — брошенный лагерь предыдущей экспедиции. D-04.', dna: ['tri', 'rap', 'spi', 'pte'] },
  queen: { eyebrow: 'Глава VI · DNA 5/5', title: 'Королева', text: 'Здесь почти нет других хищников. Причина очевидна.\nОбъект-0 — самое старое здание острова. Начинается шторм.', dna: ['tri', 'rap', 'spi', 'pte'] },
  attack: { eyebrow: 'Интерлюдия', title: 'Ночь рапторов', text: '', dna: ['tri', 'rap', 'spi'] },
  lighthouse: { eyebrow: 'Финал', title: 'Маяк', text: '', dna: ['tri', 'rap', 'spi', 'pte', 'rex'] },
  dawn: { eyebrow: 'Финал', title: 'Рассвет', text: 'Пять контейнеров. Одна консоль с шестью гнёздами.\nGENETIC SEQUENCE — PENDING.', dna: ['tri', 'rap', 'spi', 'pte', 'rex'] },
};


Game.player = null;
Game.world = null;
Game.ctx = null;

function showCard(meta) {
  return new Promise((resolve) => {
    $('cardEyebrow').textContent = meta.eyebrow;
    $('cardTitle').textContent = meta.title;
    $('cardText').textContent = meta.text;
    $('card').hidden = false;
    const btn = $('btnCard');
    const done = () => { $('card').hidden = true; btn.onclick = null; window.removeEventListener('keydown', key); resolve(); };
    const key = (e) => { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') done(); };
    btn.onclick = done;
    setTimeout(() => { window.addEventListener('keydown', key); btn.focus(); }, 350);
  });
}
function choose(eyebrow, title, text, options) {
  return new Promise((resolve) => {
    $('choiceEyebrow').textContent = eyebrow; $('choiceTitle').textContent = title; $('choiceText').textContent = text;
    const box = $('choiceBtns'); box.innerHTML = '';
    options.forEach((o) => {
      const b = document.createElement('button'); b.className = 'btn ' + (o.cls || ''); b.textContent = o.label;
      if (o.disabled) b.disabled = true;
      b.onclick = () => { $('choice').hidden = true; if (document.pointerLockElement) document.exitPointerLock(); resolve(o.id); };
      box.appendChild(b);
    });
    if (document.pointerLockElement) document.exitPointerLock();
    $('choice').hidden = false;
  });
}

function teardown() {
  Cine.active = false; HUD.letterbox(false);
  if (Game.ctx && Game.ctx.dispose) Game.ctx.dispose();
  if (Game.player && Game.player.model.parent) Game.player.model.parent.remove(Game.player.model);
  if (Game.world) Game.world.dispose();
  Game.ctx = null; Game.world = null;
  HUD.clearRadio();
  HUD.hideBig(); HUD.observe(null); HUD.danger(false); HUD.timer(null); HUD.journalChip(null);
  HUD.viewfinder(null); HUD.throwBtn(false);
  Cam.mode = 'third'; Cam.pull = null;
  Sound.silenceAll(0.8);
}

async function goChapter(id, o = {}) {
  Game.loading = true;
  Input.enabled = false;
  await HUD.fade(1, o.fast ? 0.3 : 0.9);
  teardown();
  Game.inMenu = false;
  $('menu').hidden = true;
  HUD.show(false);
  if (!o.noCard) await showCard(CHAPTER_META[id]);
  Game.currentId = id;
  if (!Game.unlocked.includes(id)) Game.unlocked.push(id);
  for (const k of CHAPTER_META[id].dna) Game.state.dna[k] = true;
  writeSave();
  seed(1983 + CHAPTER_ORDER.indexOf(id) * 97);
  const ctx = CHAPTERS[id].create(o);
  Game.ctx = ctx; Game.world = ctx.world;
  if (!Game.player) Game.player = new Player();
  Game.player.crouch = false; $('tbCrouch').classList.remove('on');
  Game.player.frozen = false;
  Game.player.heal();
  Game.player.attach(ctx.world);
  const sp = ctx.spawn || { x: 0, z: 0, yaw: 0 };
  Game.player.place(sp.x, sp.z, sp.yaw || 0);
  Cam.yaw = sp.camYaw ?? (sp.yaw || 0) + Math.PI; Cam.pitch = 0.2;
  Cam.curPos.set(sp.x, 3, sp.z + 5);
  HUD.renderCase();
  HUD.show(true);
  HUD.objective('…');
  Game.loading = false;
  Input.enabled = true;
  Input.edges.clear();
  await HUD.fade(0, 1.1);
  if (ctx.start) ctx.start(o);
}
Game.complete = async (next, opts = {}) => {
  if (Game.completing) return;
  Game.completing = true;
  if (!Game.unlocked.includes(next)) Game.unlocked.push(next);
  Game.currentId = next;
  writeSave();
  await wait(0.2);
  Game.completing = false;
  goChapter(next, opts);
};
Game.fail = async (title, sub, restore) => {
  if (Game.failing) return;
  Game.failing = true;
  Input.enabled = false;
  HUD.danger(false);
  Cam.shake = 0.8;
  await wait(0.35);
  await HUD.fade(1, 0.6);
  HUD.big(title, sub, 'bad', 2.6);
  await wait(1.6);
  if (restore) restore();
  Game.player.heal();
  Input.enabled = true;
  Input.edges.clear();
  await HUD.fade(0, 0.8);
  Game.failing = false;
};

// ---------- menu ----------
let menuWorld = null, menuT = 0;
function buildMenu() {
  const save = loadSave();
  if (save) {
    Game.unlocked = Array.isArray(save.unlocked) && save.unlocked.length ? save.unlocked.filter((c) => CHAPTER_ORDER.includes(c)) : ['prologue'];
    if (save.dna) Object.assign(Game.state.dna, save.dna);
    if (save.flags) Object.assign(Game.state.flags, save.flags);
    if (save.journal) for (const [k, v] of Object.entries(save.journal)) if (SPECIES[k]) Game.state.journal[k] = new Set(v);
    if (save.current && CHAPTER_ORDER.includes(save.current)) Game.currentId = save.current;
  }
  $('btnContinue').hidden = !(Game.currentId && Game.currentId !== 'prologue');
  if (!$('btnContinue').hidden) $('btnContinue').textContent = `Продолжить · ${CHAPTER_META[Game.currentId].title}`;
  $('helpDesk').hidden = IS_TOUCH; $('helpTouch').hidden = !IS_TOUCH;
  renderChapterList();
}
function renderChapterList() {
  const list = $('chapterList');
  list.innerHTML = '';
  CHAPTER_ORDER.forEach((id) => {
    const m = CHAPTER_META[id];
    const b = document.createElement('button');
    b.className = 'btn';
    const open = Game.unlocked.includes(id);
    b.disabled = !open;
    b.innerHTML = `<span>${m.eyebrow} · ${m.title}</span><span>${open ? 'открыта' : 'закрыта'}</span>`;
    b.onclick = () => startGame(id, true);
    list.appendChild(b);
  });
}
function startGame(id, fromSelect) {
  Sound.init();
  if (fromSelect) DNA_KEYS.forEach((k) => { Game.state.dna[k] = CHAPTER_META[id].dna.includes(k); });
  if (menuWorld) { menuWorld.dispose(); menuWorld = null; }
  goChapter(id);
}
$('btnStart').onclick = () => { resetState(); Game.unlocked = Game.unlocked.length ? Game.unlocked : ['prologue']; startGame('prologue'); };
$('btnContinue').onclick = () => startGame(Game.currentId, true);
$('btnChapters').onclick = () => { const l = $('chapterList'); l.hidden = !l.hidden; };

function openMenu() {
  teardown();
  if (Game.player && Game.player.model.parent) Game.player.model.parent.remove(Game.player.model);
  Game.inMenu = true; Game.paused = false;
  $('pause').hidden = true; $('journal').hidden = true; $('choice').hidden = true;
  HUD.show(false);
  buildMenu();
  $('menu').hidden = false;
  if (!menuWorld) menuWorld = buildValleyWorld({ time: 'dusk', menu: true }).world;
  HUD.fade(0, 1.2);
}

// ---------- pause / journal ----------
function setPaused(p) {
  if (Game.inMenu || Game.loading) return;
  Game.paused = p;
  $('pause').hidden = !p;
  if (p && document.pointerLockElement) document.exitPointerLock();
  $('btnSound').textContent = Game.muted ? 'Звук: выкл' : 'Звук: вкл';
}
$('btnResume').onclick = () => setPaused(false);
$('btnSound').onclick = () => { Sound.setMuted(!Game.muted); $('btnSound').textContent = Game.muted ? 'Звук: выкл' : 'Звук: вкл'; };
$('btnMenu').onclick = () => { setPaused(false); HUD.fade(1, 0.5).then(openMenu); };
$('btnRestartCp').onclick = () => { setPaused(false); if (Game.ctx && Game.ctx.restore) Game.fail('Контрольная точка', '', () => Game.ctx.restore()); };
function openJournal() {
  if (Game.inMenu) return;
  Game.paused = true;
  if (document.pointerLockElement) document.exitPointerLock();
  Journal.open();
}
$('btnJournalClose').onclick = () => { $('journal').hidden = true; Game.paused = false; };
document.addEventListener('visibilitychange', () => { if (document.hidden && !Game.inMenu && !Game.paused) setPaused(true); });

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(Game.dtCap || 0.05, (now - last) / 1000);
  last = now;
  HUD.beginFrame();
  if (Input.pressed('mute')) Sound.setMuted(!Game.muted);
  if (Game.inMenu) {
    Game.time += dt; WindU.value = Game.time;
    if (menuWorld) {
      menuT += dt * 0.03;
      const r = 150;
      camera.position.set(-40 + Math.sin(menuT) * r, 38, -10 + Math.cos(menuT) * r);
      camera.lookAt(-10, 8, -40);
      if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
      menuWorld.update(dt);
      renderer.render(menuWorld.scene, camera);
    }
  } else if (Game.ctx && Game.world) {
    if (!$('journal').hidden) { if (Input.pressed('journal') || Input.pressed('pause')) { $('journal').hidden = true; Game.paused = false; } }
    else if (Input.pressed('pause')) setPaused(!Game.paused);
    else if (!Game.paused && Input.pressed('journal')) openJournal();
    if (!Game.paused && !Game.loading) {
      dt *= Game.timeScale || 1;
      Game.time += dt; WindU.value = Game.time;
      if (Input.enabled && !Cine.active) {
        if (Input.pressed('photo') && Game.ctx.allowPhoto !== false) Photo.toggle('photo');
        if (Input.pressed('throw') && Game.ctx.onThrow) Game.ctx.onThrow();
      }
      if (!Cine.active) Game.player.update(dt);
      Game.ctx.update(dt);
      Game.world.update(dt);
      Interact.update(dt, Game.world);
      if ((Cam.mode === 'photo') && Input.pressed('shoot')) Photo.shoot(Game.world.scene, Game.ctx.subjects ? Game.ctx.subjects() : []);
      if (Cam.mode === 'aim' && Input.pressed('shoot') && Game.ctx.onShoot) Game.ctx.onShoot();
      Cine.update(dt);
      Cam.update(dt);
      const p = Game.player.pos;
      const mk = (Game.ctx.markers ? Game.ctx.markers() : []).map((m) => ({ ...m, bearing: Math.atan2(m.x - p.x, -(m.z - p.z)) }));
      HUD.compass(Cam.heading(), mk);
    }
    renderer.render(Game.world.scene, camera);
  }
  HUD.endFrame();
  Input.endFrame();
}

// ---------- boot ----------
function boot() {
  buildMenu();
  menuWorld = buildValleyWorld({ time: 'dusk', menu: true }).world;
  $('boot').hidden = true;
  $('menu').hidden = false;
  HUD.fade(0, 1.4);
  requestAnimationFrame(frame);
}
window.__umbra = { Game, goChapter, CHAPTERS, Journal, DNA, HUD, Cam, Input, Cine, get ctx() { return Game.ctx; } };
boot();
