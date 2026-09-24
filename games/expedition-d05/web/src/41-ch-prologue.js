// ============================================================
// 41-ch-prologue.js — Threshold Station: briefing and the case
// ============================================================
function drawBriefingScreen(g, w, h, st) {
  g.fillStyle = '#04121c'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(80,170,210,0.12)'; g.lineWidth = 1;
  for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  // island silhouette
  g.save(); g.translate(330, 260);
  g.fillStyle = st.veil ? 'rgba(160,180,190,0.35)' : 'rgba(70,160,110,0.55)';
  g.beginPath();
  for (let i = 0; i <= 60; i++) { const a = (i / 60) * TAU; const r = 170 + 30 * Math.sin(a * 3 + 1) + 18 * Math.sin(a * 7); g.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.8); }
  g.fill();
  g.strokeStyle = 'rgba(120,220,170,0.8)'; g.lineWidth = 2; g.stroke();
  if (!st.veil) {
    const zones = [[60, -60], [-40, -20], [110, 40], [-10, -110], [-120, 60]];
    zones.slice(0, st.n).forEach(([x, y], i) => {
      g.strokeStyle = i === 4 ? 'rgba(255,80,60,0.95)' : 'rgba(227,163,59,0.95)';
      g.setLineDash([6, 5]); g.beginPath(); g.arc(x, y, 26, 0, TAU); g.stroke(); g.setLineDash([]);
    });
  }
  g.restore();
  g.fillStyle = '#9fd6ea'; g.font = '600 26px "Fira Sans Extra Condensed", Arial Narrow, sans-serif';
  g.fillText('SITE U — ISOLATED ECOSYSTEM', 40, 50);
  g.fillStyle = 'rgba(159,214,234,0.6)'; g.font = '500 18px "IBM Plex Mono", monospace';
  g.fillText(st.veil ? 'STATUS: CLOUD COVER 100% · VEIL ACTIVE' : 'STATUS: UNEXPLORED 87%', 40, 80);
  const names = ['TRICERATOPS', 'VELOCIRAPTOR', 'SPINOSAURUS', 'PTERANODON', 'TYRANNOSAURUS REX'];
  g.font = '600 28px "Fira Sans Extra Condensed", Arial Narrow, sans-serif';
  names.slice(0, st.n).forEach((n, i) => {
    g.fillStyle = i === 4 ? '#ff6a56' : '#e8f4f6';
    g.fillText(n, 660, 150 + i * 48);
    g.fillStyle = i === 4 ? 'rgba(255,106,86,0.8)' : 'rgba(227,163,59,0.9)';
    g.font = '500 15px "IBM Plex Mono", monospace'; g.fillText('DNA REQUIRED', 660, 170 + i * 48);
    g.font = '600 28px "Fira Sans Extra Condensed", Arial Narrow, sans-serif';
  });
  if (st.n >= 5) {
    g.fillStyle = '#e8f4f6'; g.font = '600 24px "Fira Sans Extra Condensed", Arial Narrow, sans-serif';
    g.fillText('COLLECT DNA SAMPLES', 660, 420);
    g.fillStyle = '#ff5a48'; g.font = '700 54px "IBM Plex Mono", monospace'; g.fillText('0 / 5', 660, 475);
  }
  if (st.title) { g.fillStyle = '#e8f4f6'; g.font = '700 44px "Fira Sans Extra Condensed", Arial Narrow, sans-serif'; g.fillText('EXPEDITION D-05', 660, 150); g.font = '500 18px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(227,163,59,0.9)'; g.fillText('PRIMARY OBJECTIVE:', 660, 200); g.fillText('COLLECT 5 GENETIC SAMPLES', 660, 226); }
}

function makeCaseModel() {
  const g = new THREE.Group();
  mesh(G.box(1.1, 0.22, 0.62), mat('#1b1f20', { rough: 0.45, metal: 0.5 }), { parent: g, pos: [0, 0.11, 0] });
  mesh(G.box(1.02, 0.02, 0.54), mat('#2b2f2a'), { parent: g, pos: [0, 0.225, 0] });
  const lid = new THREE.Group(); lid.position.set(0, 0.22, -0.31); g.add(lid);
  mesh(G.box(1.1, 0.06, 0.62), mat('#1b1f20', { rough: 0.45, metal: 0.5 }), { parent: lid, pos: [0, 0.03, 0.31] });
  lid.rotation.x = -1.9;
  const caps = [];
  for (let i = 0; i < 6; i++) {
    const x = -0.42 + i * 0.168;
    if (i < 5) {
      const c = mesh(G.cyl(0.05, 0.05, 0.36, 10), new THREE.MeshStandardMaterial({ color: '#9fc4d6', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55 }), { parent: g, pos: [x, 0.25, 0], rot: [Math.PI / 2, 0, 0] });
      const ring = mesh(G.cyl(0.055, 0.055, 0.03, 10), new THREE.MeshStandardMaterial({ color: '#222', emissive: new THREE.Color('#e3a33b'), emissiveIntensity: 1.6 }), { parent: g, pos: [x, 0.25, 0.17], rot: [Math.PI / 2, 0, 0], cast: false });
      caps.push({ c, ring });
    } else {
      const naTex = canvasTex(64, 128, (gg, w, h) => { gg.fillStyle = '#6b6f6a'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#1b1d1c'; gg.font = 'bold 26px Arial'; gg.textAlign = 'center'; gg.save(); gg.translate(w / 2, h / 2); gg.rotate(-Math.PI / 2); gg.fillText('N/A', 0, 9); gg.restore(); });
      mesh(G.box(0.1, 0.02, 0.36), new THREE.MeshStandardMaterial({ map: naTex, roughness: 0.7 }), { parent: g, pos: [x, 0.24, 0] });
    }
  }
  g.userData = { lid, caps };
  return g;
}

CHAPTERS.prologue = {
  create() {
    const world = new World();
    world.floor = () => 0;
    world.ceiling = 3.6;
    world.scene.background = new THREE.Color('#07090a');
    world.scene.fog = new THREE.Fog('#07090a', 18, 40);
    const hemi = new THREE.HemisphereLight('#9fbcd2', '#2a302a', 0.9); world.add(hemi);
    world.hemi = hemi; world.baseHemi = 0.9;
    const warm = new THREE.PointLight('#ffd49a', 22, 18, 1.5); warm.position.set(0, 3.2, 3.5); warm.castShadow = true; world.add(warm);
    const blue = new THREE.PointLight('#6ab8e8', 10, 12, 1.8); blue.position.set(0, 2.4, -1.6); world.add(blue);
    const side = new THREE.PointLight('#ffe0b0', 8, 10, 1.6); side.position.set(7, 2.8, 1); world.add(side);
    // room
    const W = 9, D = 7;
    mesh(G.box(W * 2, 0.1, D * 2), mat('#2a2f2d', { rough: 0.7 }), { parent: world.scene, pos: [0, -0.05, 0], receive: true, cast: false });
    mesh(G.box(W * 2, 0.1, D * 2), mat('#1a1d1c'), { parent: world.scene, pos: [0, 3.65, 0], cast: false });
    const wallM = mat('#3a403c', { rough: 0.8 });
    const wall = (x0, x1, z0, z1) => { mesh(G.box(x1 - x0, 3.7, z1 - z0), wallM, { parent: world.scene, pos: [(x0 + x1) / 2, 1.85, (z0 + z1) / 2], receive: true }); world.boxes.push({ x0, x1, z0, z1 }); };
    wall(-W, W, -D - 0.3, -D); wall(-W, W, D, D + 0.3); wall(-W - 0.3, -W, -D, D); wall(W, W + 0.3, -D, D);
    // screen
    const scr = { n: 0, veil: true, title: false };
    const scrCanvas = document.createElement('canvas'); scrCanvas.width = 1024; scrCanvas.height = 512;
    const scrTex = new THREE.CanvasTexture(scrCanvas); scrTex.colorSpace = THREE.SRGBColorSpace;
    const redraw = () => { drawBriefingScreen(scrCanvas.getContext('2d'), 1024, 512, scr); scrTex.needsUpdate = true; };
    redraw();
    mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }), { parent: world.scene, pos: [0, 2.0, -6.95], cast: false });
    // holotable
    mesh(G.cyl(1.6, 1.8, 0.9, 20), mat('#1c2426', { metal: 0.5, rough: 0.4 }), { parent: world.scene, pos: [0, 0.45, -1.6] });
    const holo = mesh(G.cyl(1.4, 1.4, 0.02, 24), new THREE.MeshBasicMaterial({ color: '#4fc3e8', transparent: true, opacity: 0.35 }), { parent: world.scene, pos: [0, 0.95, -1.6], cast: false });
    const holoIsland = mesh(G.cone(1.0, 0.6, 10), new THREE.MeshBasicMaterial({ color: '#56d6a0', wireframe: true, transparent: true, opacity: 0.6 }), { parent: world.scene, pos: [0, 1.3, -1.6], cast: false });
    world.circles.push({ x: 0, z: -1.6, r: 1.9 });
    world.onUpdate((dt) => { holoIsland.rotation.y += dt * 0.3; holo.material.opacity = 0.3 + Math.sin(Game.time * 3) * 0.05; });
    // desks & monitors
    const deskM = mat('#2c3130'), monM = new THREE.MeshBasicMaterial({ color: '#1f5a70' });
    [[-4.5, 3], [4.5, 3], [-6.5, -3.5], [6.5, -3.5]].forEach(([x, z]) => {
      mesh(G.box(3.2, 0.8, 1), deskM, { parent: world.scene, pos: [x, 0.4, z], receive: true });
      mesh(G.box(0.9, 0.55, 0.05), monM, { parent: world.scene, pos: [x - 0.7, 1.1, z - 0.3], cast: false });
      mesh(G.box(0.9, 0.55, 0.05), monM, { parent: world.scene, pos: [x + 0.7, 1.1, z - 0.3], cast: false });
      world.boxes.push({ x0: x - 1.6, x1: x + 1.6, z0: z - 0.5, z1: z + 0.5, low: true });
    });
    // case table
    mesh(G.box(2, 0.9, 1.2), mat('#dfe2dd', { rough: 0.5 }), { parent: world.scene, pos: [7.3, 0.45, 0.8] });
    world.boxes.push({ x0: 6.3, x1: 8.3, z0: 0.2, z1: 1.4, low: true });
    const caseM = makeCaseModel(); caseM.position.set(7.3, 0.9, 0.8); caseM.rotation.y = -Math.PI / 2; world.add(caseM);
    // storage crate: D-04 personal effects
    const boxTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#6a6448'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1a12'; g.font = 'bold 22px Arial'; g.fillText('D-04 — PERSONAL EFFECTS', 12, 50); g.font = 'bold 26px Arial'; g.fillText('UNCLAIMED', 12, 92); });
    mesh(G.box(1.1, 0.7, 0.8), new THREE.MeshLambertMaterial({ map: boxTex }), { parent: world.scene, pos: [-7.8, 0.35, 5.6], rot: [0, 0.3, 0] });
    world.circles.push({ x: -7.8, z: 5.6, r: 0.7 });
    // ARK MIRROR door (west wall)
    const arkTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#b8281e'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 24px Arial'; g.textAlign = 'center'; g.fillText('ARK MIRROR — RESTRICTED', w / 2, 40); });
    mesh(G.box(0.08, 2.4, 1.4), mat('#2b3033', { metal: 0.4 }), { parent: world.scene, pos: [-8.95, 1.2, -1], cast: false });
    mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: arkTex }), { parent: world.scene, pos: [-8.9, 2.6, -1], rot: [0, Math.PI / 2, 0], cast: false });
    // hangar door (east wall)
    const hangTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#e3a33b'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText('HANGAR →', w / 2, 44); });
    mesh(G.box(0.08, 2.5, 1.6), mat('#39403a', { metal: 0.3 }), { parent: world.scene, pos: [8.95, 1.25, 4.5], cast: false });
    mesh(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshBasicMaterial({ map: hangTex }), { parent: world.scene, pos: [8.9, 2.75, 4.5], rot: [0, -Math.PI / 2, 0], cast: false });

    // people
    const npc = {};
    const put = (key, x, z, ry, look = key) => { const n = makeNPC(look); n.position.set(x, 0, z); n.rotation.y = ry; world.add(n); world.circles.push({ x, z, r: 0.45 }); npc[key] = n; return n; };
    put('halm', 0.3, -4.6, 0.1);
    put('lena', -3.6, -2.2, 0.9);
    put('diego', 5.4, -2.2, -0.7);
    put('lucas', 3.6, 1.6, -2.6);
    put('yusuf', 8.1, 1.9, -2.2, 'tech');
    put('tech1', -4.6, 3.9, Math.PI, 'tech');
    world.onUpdate((dt) => { Object.values(npc).forEach((n) => n.userData.anim(dt, 0, {})); });

    Sound.bed('rain', 0.04); Sound.bed('hum', 0.035);
    const S = { stage: 0 };
    const ctx = {
      world, spawn: { x: 0, z: 3.2, yaw: Math.PI }, allowPhoto: false,
      markers() {
        if (S.stage === 0) return [{ x: 0, z: -4.6, label: 'Хальм' }];
        if (S.stage === 1) return [{ x: 7.3, z: 0.8, label: 'кейс' }];
        if (S.stage === 2) return [{ x: 8.9, z: 4.5, label: 'ангар' }];
        return [];
      },
      subjects() { return []; },
      async start() {
        HUD.objective('Доложите Хальму о прибытии', 'Командный центр. Подойдите к руководителю экспедиции и нажмите E.');
        await wait(1.2);
        HUD.say([{ who: 'Нора (интерком)', text: 'Мистер Рид, брифинг начинается. Командный центр, у большого экрана.' }]);
      },
      update(dt) {},
    };
    // briefing
    world.interact({
      x: 0.3, z: -3.6, r: 2.4, label: 'Слушать брифинг', enabled: () => S.stage === 0,
      onUse: async () => {
        S.stage = -1;
        const P = Game.player;
        P.place(0, -2.8 + 4.2, Math.PI);
        const lines = (arr) => HUD.say(arr.map(([who, text, dur]) => ({ who, text, dur })));
        warm.intensity = 5; side.intensity = 3;
        await Cine.play([
          { from: V(0, 2.6, 6), to: V(0, 2.2, 3.5), look: V(0, 1.9, -6), dur: 4, cut: true, onStart: () => { Sound.sfx('door'); scr.veil = true; redraw(); lines([['Хальм', 'Доброе утро. Кто ещё не проснулся — сейчас проснётся. Это Умбра.', 4]]); } },
          { from: V(2.2, 1.7, -1.8), to: V(1.7, 1.7, -2.4), look: V(0.3, 1.55, -4.6), dur: 7, cut: true, onStart: () => lines([['Хальм', 'Сорок лет её нет ни на одной карте. Под этими облаками — экосистема, которой не должно существовать.', 4.2], ['Лена', '«Не должно» — в каком смысле?', 2.6]]) },
          { from: V(-3.2, 1.8, 0.6), to: V(-2.6, 1.8, 0.2), look: V(0.3, 1.5, -4.6), dur: 7, cut: true, onStart: () => { scr.veil = false; redraw(); Sound.sfx('ping'); lines([['Хальм', 'В любом, доктор Арден. Предыдущие исследования… исследование было прекращено. Связь с частью старых объектов потеряна.', 5], ['Хальм', 'Что там сейчас — мы не знаем. Поэтому летите вы.', 2.5]]); } },
          { from: V(0, 2.1, -3.0), to: V(0, 2.05, -3.6), look: V(1.8, 2.1, -6.95), dur: 9.5, cut: true, onStart: () => {
            lines([['Хальм', 'Пять видов. Пять генетических образцов.', 2.6], ['Хальм', 'Трицератопс. Велоцираптор. Спинозавр. Птеранодон.', 3.6]]);
            [0, 1, 2, 3].forEach((i) => setTimeout(() => { scr.n = i + 1; redraw(); Sound.sfx('ping', 0.8); }, 2600 + i * 900));
          } },
          { from: V(0, 2.05, -3.6), look: V(1.8, 2.1, -6.95), dur: 2.2, onStart: () => { Sound.silenceAll(0.4); } },
          { from: V(0.6, 2.0, -4.2), to: V(0.5, 2.0, -4.6), look: V(1.8, 2.0, -6.95), dur: 3.5, onStart: () => { scr.n = 5; redraw(); Sound.sfx('thud', 0.9); Sound.tone(49, 2.5, 'sawtooth', 0.12, 0, 41); lines([['Хальм', 'И тираннозавр.', 2.4]]); } },
          { from: V(3.2, 1.7, -0.6), to: V(3.4, 1.7, -0.9), look: V(5.4, 1.6, -2.2), dur: 3.2, cut: true, onStart: () => lines([['Диего', 'Вы серьёзно хотите, чтобы мы приблизились к нему?', 3]]) },
          { from: V(1.4, 1.7, -2.6), look: V(0.3, 1.55, -4.6), dur: 3.2, cut: true, onStart: () => lines([['Хальм', 'Вам не нужно его убивать. Нам нужен только образец.', 3]]) },
          { from: V(1.6, 1.7, 3.8), to: V(1.9, 1.7, 3.6), look: V(3.6, 1.2, 1.6), dur: 4.2, cut: true, onStart: () => lines([['Лукас', 'Отличная новость. А ему кто-нибудь скажет, что нам нужен только образец?', 4]]) },
        ], { skippable: true });
        Sound.bed('rain', 0.04); Sound.bed('hum', 0.035);
        const ans = await choose('Брифинг', 'Спросить Хальма', 'Хальм ждёт вопросов. Можно спросить или промолчать.', [
          { id: 'why', label: '«Почему я? Я не учёный.»' },
          { id: 'prev', label: '«Что случилось с прошлой группой?»' },
          { id: 'none', label: 'Промолчать' },
        ]);
        Game.state.flags.briefQ = ans;
        if (ans === 'why') await HUD.say([{ who: 'Хальм', text: 'Потому что учёные смотрят на животных. А вы — на то, что животные оставляют.' }]);
        else if (ans === 'prev') await HUD.say([{ who: 'Хальм', text: '<em>(пауза)</em> Они приняли неверные решения. Вы примете верные.' }]);
        else await HUD.say([{ who: '', text: '<em>Хальм смотрит на Итана дольше, чем на остальных, и кивает.</em>', dur: 2.6 }]);
        warm.intensity = 14; side.intensity = 8;
        HUD.say([{ who: 'Хальм', text: 'Вылет в шесть десять. Доктор Арден, выдайте мистеру Риду комплект.' }]);
        S.stage = 1;
        HUD.objective('Получите кейс для образцов', 'Стол ДНК-лаборатории у восточной стены.');
      },
    });
    world.interact({
      x: 6.4, z: 0.8, r: 2.0, label: 'Взять кейс', enabled: () => S.stage === 1,
      onUse: async () => {
        S.stage = -1;
        const caps = caseM.userData.caps;
        caps.forEach((c) => { c.ring.material.emissiveIntensity = 0; });
        await Cine.play([
          { from: V(6.3, 1.9, 0.8), to: V(6.55, 1.7, 0.8), look: V(7.3, 0.95, 0.8), dur: 3.6, cut: true, fov: 45, onStart: () => { Sound.sfx('lever'); HUD.say([{ who: 'Юсуф', text: 'Пять капсул. Каждая держит клетки живыми до двух недель.', dur: 3.4 }]); caps.forEach((c, i) => setTimeout(() => { c.ring.material.emissiveIntensity = 1.6; Sound.sfx('ping', 0.6); }, 400 + i * 450)); } },
          { from: V(7.3, 1.75, 0.2), to: V(7.3, 1.6, 0.55), look: V(7.3, 0.95, 1.28), dur: 4.6, cut: true, fov: 40, onStart: () => HUD.say([{ who: 'Лена', text: 'Главное правило, Итан. Нам нужна <b>живая</b> ткань. Кровь, перо, биопсия. Мёртвое не подойдёт — клетки должны дышать.', dur: 4.6 }]) },
          { from: V(7.3, 1.5, 0.8), to: V(7.25, 1.35, 1.0), look: V(7.3, 0.95, 1.28), dur: 3.4, fov: 34, onStart: () => HUD.say([{ who: 'Лена', text: 'А шестое?', dur: 1.6 }, { who: 'Юсуф', text: 'Старый чертёж. Кейсы делают по спецификации восьмидесятых. Не обращайте внимания.', dur: 3.2 }]) },
          { from: V(5.6, 1.9, 2.2), look: V(7.3, 1.0, 0.8), dur: 2.6, cut: true, fov: 50, onStart: () => HUD.say([{ who: 'Лена', text: '<em>(тихо)</em> В восьмидесятых…', dur: 2.2 }]) },
        ]);
        caseM.visible = false;
        Game.state.flags.hasCase = true;
        HUD.renderCase();
        HUD.big('GENETIC SAMPLES: 0/5', 'КЕЙС НА РЮКЗАКЕ · ОГОНЬКИ ПОКАЗЫВАЮТ ПРОГРЕСС', '', 3.8);
        S.stage = 2;
        HUD.objective('Идите в ангар', 'Дверь с жёлтой табличкой у восточной стены. Вертолёт уже прогревают.');
        HUD.say([{ who: 'Хальм', text: 'Мистер Рид. Первое правило острова: там тихо, если тихо вы сами.' }]);
      },
    });
    world.interact({ x: 8.3, z: 4.5, r: 1.8, label: 'Выйти в ангар', enabled: () => S.stage === 2, onUse: () => { S.stage = 3; Game.complete('valley', { flight: true, noCard: false }); } });
    world.interact({
      x: -7.8, z: 5.6, r: 1.9, label: 'Осмотреть ящик', enabled: () => !S.box,
      onUse: () => { S.box = true; HUD.say([{ who: '[Ящик]', text: '«D-04 — PERSONAL EFFECTS — UNCLAIMED». Внутри шляпа и детский рисунок: остров и подпись «Маме».', dur: 5 }, { who: 'Итан', text: 'D-04. Значит, были и D-01, D-02, D-03.', dur: 3 }]); Game.state.flags.clueBox = true; },
    });
    world.interact({
      x: -8.2, z: -1, r: 1.8, label: 'Осмотреть дверь', enabled: () => !S.ark,
      onUse: () => { S.ark = true; HUD.say([{ who: '[Дверь]', text: 'Заперто. «ARK MIRROR — RESTRICTED». Сквозь стекло видны серверные стойки. Кто-то изнутри опускает жалюзи.', dur: 5 }]); Game.state.flags.clueArk = true; },
    });
    world.interact({ x: 3.6, z: 2.4, r: 1.7, label: 'Поговорить с Лукасом', enabled: () => !S.lucas && S.stage >= 1, onUse: () => { S.lucas = true; HUD.say([{ who: 'Лукас', text: 'Следопыт! Над этим островом никто не летал. Вокруг — сколько угодно, там приборы сходят с ума.', dur: 4.2 }, { who: 'Лукас', text: 'Так что, если что, я просто очень уверенно поверну обратно.', dur: 3.2 }]); } });
    world.interact({ x: -3.6, z: -1.3, r: 1.7, label: 'Поговорить с Леной', enabled: () => !S.lena && S.stage >= 1, onUse: () => { S.lena = true; HUD.say([{ who: 'Лена', text: 'Я всю жизнь собирала ДНК из костей. Это как читать книгу по обгоревшим страницам.', dur: 4 }, { who: 'Лена', text: 'А там… там книги живые.', dur: 2.6 }]); } });
    world.interact({ x: 5.4, z: -1.3, r: 1.7, label: 'Поговорить с Диего', enabled: () => !S.diego, onUse: () => { S.diego = true; HUD.say([{ who: 'Диего', text: 'Двенадцать патронов. Больше не дам — там патроны не растут.', dur: 3.2 }, { who: 'Диего', text: 'Ракеты — твой лучший друг. Пули только злят то, что больше тебя.', dur: 3.6 }]); } });
    ctx.restore = () => Game.player.place(0, 3.2, Math.PI);
    return ctx;
  },
};
