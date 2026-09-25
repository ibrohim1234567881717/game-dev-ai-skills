// ============================================================
// 47-ch-truth.js — Chapter V: volcanic zone, caves (EVA-0), lost camp D-04
// ============================================================
const TRUTH = {
  tunnels: [
    [[-60, 46, 2.2, 3.6], [-60, 22, 1.2, 3.6]], [[-60, 22, 1.2, 3.6], [-66, 4, 0.2, 3.6]], [[-66, 4, 0.2, 3.6], [-78, -12, -1.2, 21]],
    [[-78, -12, -1.2, 21], [-60, -40, 0.8, 4]], [[-60, -40, 0.8, 4], [-45, -58, 8, 4]], [[-45, -58, 8, 4], [-36, -74, 15.5, 4.2]], [[-36, -74, 15.5, 4.2], [-32, -90, 18, 5]],
    [[-66, 4, 0.2, 3.2], [-84, 12, 0.2, 3]],
    [[-78, -12, -1.2, 6], [-110, -28, -0.6, 2.6]], [[-110, -28, -0.6, 2.6], [-124, -44, -0.6, 5]],
  ],
  hall: [-78, -12], alcove: [-84, 12], shelter: [-124, -44], crevice: [-100, -22],
  gas: [[-20, 104, 11], [-44, 80, 9], [8, 70, 8]], vents: [[-8, 118], [-30, 92], [-2, 84], [-50, 60]],
  bunkers: [[20, 110], [30, 88]], core: [-6, 96],
  camp: [-18, -112],
};
function tunnelInfo(x, z) {
  let best = 1e9, y = 0;
  for (const [a, b] of TRUTH.tunnels) {
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1);
    const px = a[0] + dx * t, pz = a[1] + dz * t;
    const s = Math.hypot(x - px, z - pz) - lerp(a[3], b[3], t);
    if (s < best) { best = s; y = lerp(a[2], b[2], t); }
  }
  return { s: best, y };
}
const inCaveRegion = (x, z) => x > -150 && x < -18 && z > -82 && z < 42;
const underRoof = (x, z) => x > -146 && x < -22 && z > -46 && z < 36;
function truthH(x, z) {
  let h = 2 + fbm(x * 0.03, z * 0.03, 3) * 2.2;
  h = lerp(h, 18 + fbm(x * 0.05, z * 0.05, 2) * 1.2, smoothstep(-58, -84, z));
  h -= smoothstep(-150, -178, z) * 46;
  const trench = Math.abs(z - (28 + Math.sin(x * 0.03) * 3));
  if (x > -40) h = lerp(-3, h, smoothstep(4, 9, trench));
  if (inCaveRegion(x, z)) {
    const { s, y } = tunnelInfo(x, z);
    const edge = Math.min(x + 150, -18 - x, z + 82, 42 - z);
    const mesa = lerp(h, 16 + fbm(x * 0.1, z * 0.1, 2) * 2, smoothstep(0, 6, edge));
    h = s < 0 ? y + fbm(x * 0.4, z * 0.4, 1) * 0.1 : lerp(y, mesa, smoothstep(0, 2.2, s));
    const dp = dist2d(x, z, TRUTH.hall[0] + 6, TRUTH.hall[1] + 2);
    if (dp < 9) h = Math.min(h, lerp(-1.9, h, smoothstep(5, 9, dp)));
  }
  return h;
}

CHAPTERS.truth = {
  create() {
    seed(9090);
    const world = new World({ bounds: { x: -40, z: -10, r: 160 } });
    applyTime(world, 'dusk');
    world.scene.fog = new THREE.Fog('#6b5a50', 30, 260);
    world.sky.material.uniforms.top.value.set('#4a4046'); world.sky.material.uniforms.hor.value.set('#b0785a');
    makeTerrain(world, { size: 360, seg: 200, cx: -40, cz: -10, height: truthH, color: (x, z, y, s, c) => {
      c.set('#2a2826').lerp(_tmpC.set('#36322e'), fbm(x * 0.08, z * 0.08, 2) * 0.5 + 0.5);
      if (z < -60 && !inCaveRegion(x, z)) c.lerp(_tmpC.set('#4a4a3c'), 0.5);
      if (inCaveRegion(x, z) && y < 3) c.set('#3a3934').lerp(_tmpC.set('#2e3a34'), fbm(x * 0.2, z * 0.2, 1) * 0.5 + 0.5);
      if (s > 0.4) c.lerp(_tmpC.set('#403c38'), 0.5);
    } });
    world.floor = (x, z) => world.terrain.sample(x, z);
    world.maxSlope = 1.3;
    makeWater(world, { y: -0.8, size: 700, x: -40, z: -10, color: '#2d4a4a', opacity: 0.8 });
    // lava trench
    const lavaTex = canvasTex(256, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff8a2a'); gr.addColorStop(0.5, '#ffcf5a'); gr.addColorStop(1, '#ff5a1a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(40,10,0,${rnd(0.2, 0.6)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(6, 30), rnd(2, 8)); } });
    lavaTex.wrapS = THREE.RepeatWrapping; lavaTex.repeat.set(8, 1);
    const lava = mesh(new THREE.PlaneGeometry(260, 9), new THREE.MeshBasicMaterial({ map: lavaTex, toneMapped: false }), { parent: world.scene, pos: [90, -0.6, 28], rot: [-Math.PI / 2, 0, 0], cast: false });
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight('#ff7a2a', 30, 40, 1.6); l.position.set(-30 + i * 40, 3, 28); world.add(l); }
    world.onUpdate((dt) => { lavaTex.offset.x += dt * 0.02; });
    world.blocked = (x, z) => {
      if (x > -40 && Math.abs(z - (28 + Math.sin(x * 0.03) * 3)) < 6) return true;
      if (Journal.pct('eva') < 50 && dist2d(x, z, TRUTH.crevice[0], TRUTH.crevice[1]) < 3.5) return true;
      return false;
    };
    // cave roof
    const roof = mesh(G.box(124, 1, 82), mat('#1b1a18', { rough: 1 }), { parent: world.scene, pos: [-84, 8.2, -5], cast: false, receive: false });
    roof.material.side = THREE.DoubleSide;
    // steam vents, gas pockets
    const steamPts = [];
    TRUTH.vents.forEach(([x, z]) => { const cone = mesh(G.cone(1.4, 1.2, 8), mat('#3a3430'), { parent: world.scene, pos: [x, truthH(x, z) + 0.4, z] }); world.circles.push({ x, z, r: 1.2 }); steamPts.push({ x, z, y: truthH(x, z) + 1, phase: rnd(0, 4) }); });
    const steamGeo = new THREE.BufferGeometry(); const SN = 60 * steamPts.length; const sPos = new Float32Array(SN * 3);
    steamGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ color: '#e8e4dc', size: 1.4, transparent: true, opacity: 0.35, depthWrite: false }));
    steam.frustumCulled = false; world.add(steam);
    world.onUpdate(() => {
      steamPts.forEach((v, vi) => {
        const burst = ((Game.time + v.phase) % 4) < 1.2;
        v.burst = burst;
        for (let i = 0; i < 60; i++) { const k = ((Game.time * (burst ? 0.9 : 0.25) + i / 60) % 1); const j = (vi * 60 + i) * 3; sPos[j] = v.x + Math.sin(i * 7.1) * k * 1.6; sPos[j + 1] = v.y + k * (burst ? 9 : 3.5); sPos[j + 2] = v.z + Math.cos(i * 5.3) * k * 1.6; }
      });
      steamGeo.attributes.position.needsUpdate = true;
    });
    TRUTH.gas.forEach(([x, z, r]) => { mesh(G.sphere(r, 14, 8), new THREE.MeshBasicMaterial({ color: '#c9c070', transparent: true, opacity: 0.16, depthWrite: false }), { parent: world.scene, pos: [x, truthH(x, z) + 1, z], scale: [1, 0.35, 1], cast: false }); });
    makeMotes(world, { color: '#9a9690', count: QUALITY ? 500 : 240, fall: -0.4, size: 0.1 });
    // bunkers & core station
    TRUTH.bunkers.forEach(([x, z]) => { const b = new THREE.Group(); mesh(G.box(3, 1.2, 3), mat('#5a5a52'), { parent: b, pos: [0, 0.6, 0] }); mesh(G.cyl(0.8, 0.8, 0.2, 12), mat('#6a6a60', { metal: 0.5 }), { parent: b, pos: [0, 1.25, 0] }); const tx = canvasTex(128, 32, (g, w, h) => { g.fillStyle = '#e3a33b'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 18px Arial'; g.fillText('ORIGO-2017', 8, 23); }); mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ map: tx }), { parent: b, pos: [0, 0.7, 1.52], cast: false }); b.position.set(x, truthH(x, z), z); world.add(b); world.circles.push({ x, z, r: 2 }); });
    const rig = new THREE.Group();
    for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [0, 1.5]]) mesh(G.box(0.2, 7, 0.2), mat('#6a4a2a', { metal: 0.3 }), { parent: rig, pos: [a, 3.5, b], rot: [b * 0.05, 0, a * -0.05] });
    for (let i = 0; i < 5; i++) mesh(G.cyl(0.18, 0.18, 1.4, 8), mat(i % 2 ? '#3a3632' : '#56504a'), { parent: rig, pos: [2.6, 0.2 + i * 0.01, -1 + i * 0.5], rot: [0, 0, Math.PI / 2] });
    rig.position.set(TRUTH.core[0], truthH(...TRUTH.core), TRUTH.core[1]); world.add(rig); world.circles.push({ x: TRUTH.core[0], z: TRUTH.core[1], r: 2 });
    // cave: glow fungi & lights, prints, Diego, shelter
    const glowM = new THREE.MeshBasicMaterial({ color: '#5affd6' });
    scatterInstanced(world, G.sphere(0.12, 6, 4), glowM, scatter(QUALITY ? 360 : 180, () => { const x = rnd(-140, -30), z = rnd(-48, 38); const t = tunnelInfo(x, z); if (t.s > 1.5 || t.s < 0) return null; return { x, y: truthH(x, z) + rnd(0, 2.5), z, s: rnd(0.6, 1.6) }; }), { cast: false, receive: false });
    [[-60, 20], [-78, -12], [-70, -30], [-110, -30], [-84, 10]].forEach(([x, z]) => { const l = new THREE.PointLight('#43e0c0', 7, 22, 1.6); l.position.set(x, truthH(x, z) + 3, z); world.add(l); });
    const flash = makeFlashlight(world, 30); flash.intensity = 0;
    const cavePlants = scatter(QUALITY ? 200 : 100, () => { const x = rnd(-140, -30), z = rnd(-48, 38); const t = tunnelInfo(x, z); if (t.s > 0 || t.s < -3) return null; return { x, y: truthH(x, z), z, s: rnd(0.5, 1.1), ry: rnd(0, TAU), tint: '#49c8a0' }; });
    makeFerns(world, cavePlants, { color: '#8affd8' });
    for (let i = 0; i < 7; i++) { const x = -62 + i * 0.9, z = 30 - i * 2.4; decal(world, x, z, { size: 1.6, ry: Math.PI + 0.2, map: canvasTex(64, 64, (g) => { g.fillStyle = 'rgba(20,16,12,0.85)'; g.beginPath(); g.ellipse(32, 42, 12, 14, 0, 0, TAU); g.fill(); [[-16, 14, -0.5], [-5, 8, -0.15], [6, 8, 0.15], [17, 14, 0.5]].forEach(([dx, dy, r]) => { g.save(); g.translate(32 + dx, dy + 8); g.rotate(r); g.beginPath(); g.ellipse(0, 0, 4, 10, 0, 0, TAU); g.fill(); g.restore(); }); g.strokeStyle = 'rgba(20,16,12,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(52, 50); g.lineTo(62, 64); g.stroke(); }) }); }
    const diego = makeNPC('diego'); diego.position.set(TRUTH.alcove[0], truthH(...TRUTH.alcove), TRUTH.alcove[1]); diego.rotation.y = 0.8; world.add(diego);
    world.circles.push({ x: TRUTH.alcove[0], z: TRUTH.alcove[1], r: 0.6 });
    const shelter = new THREE.Group();
    mesh(G.box(2, 0.25, 0.9), mat('#4a5a3a'), { parent: shelter, pos: [0, 0.12, 0] });
    mesh(G.box(0.4, 0.3, 0.3), mat('#2a2a2a'), { parent: shelter, pos: [1.6, 0.15, 0.6] });
    const drawTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8e2d0'; g.lineWidth = 3; g.beginPath(); g.moveTo(20, 90); g.quadraticCurveTo(80, 30, 150, 60); g.lineTo(220, 50); g.stroke(); g.beginPath(); g.moveTo(60, 70); g.lineTo(50, 110); g.moveTo(120, 60); g.lineTo(125, 105); g.stroke(); g.font = 'bold 30px Georgia'; g.fillStyle = '#e8e2d0'; g.fillText('6 = ЕВА', 120, 118); });
    mesh(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshBasicMaterial({ map: drawTex, transparent: true }), { parent: shelter, pos: [0, 2, -2.2], cast: false });
    shelter.position.set(TRUTH.shelter[0], truthH(...TRUTH.shelter), TRUTH.shelter[1]); world.add(shelter);
    const skin = mesh(G.box(1.2, 0.08, 0.8), mat('#d8d2c2', { rough: 0.4 }), { parent: world.scene, pos: [TRUTH.shelter[0] + 3, truthH(TRUTH.shelter[0] + 3, TRUTH.shelter[1] - 2) + 0.05, TRUTH.shelter[1] - 2], rot: [0, 0.5, 0.08], cast: false });
    // EVA-0
    const eva = makeEva(); world.add(eva);
    const E = { x: TRUTH.hall[0], z: TRUTH.hall[1] - 6, yaw: 0, state: 'roam', t: 0, target: { x: TRUTH.hall[0], z: TRUTH.hall[1] }, listen: 0, seen: false };
    let dripT = 1.5, maskT = 0;
    // lost camp
    const cx = TRUTH.camp[0], cz = TRUTH.camp[1];
    const campH = (x, z) => truthH(x, z);
    makeTent(world, cx - 8, cz + 2, 0.3, '#5a5040'); makeTent(world, cx + 8, cz + 4, -0.5, '#4f5040'); makeTent(world, cx + 1, cz - 9, 1.2, '#5a5445');
    const module = new THREE.Group();
    mesh(G.box(7, 3, 5), mat('#6a6a5e'), { parent: module, pos: [0, 1.5, 0] });
    const modTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#c9c1a6'; g.fillRect(0, 0, w, h); g.fillStyle = '#26221a'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText('D-04 · LIND', w / 2, 44); });
    mesh(new THREE.PlaneGeometry(3, 0.7), new THREE.MeshLambertMaterial({ map: modTex }), { parent: module, pos: [0, 2.5, 2.52], cast: false });
    module.position.set(cx, campH(cx, cz + 10), cz + 10); world.add(module); world.circles.push({ x: cx - 2, z: cz + 10, r: 2.6 }, { x: cx + 2, z: cz + 10, r: 2.6 });
    for (let i = 0; i < 5; i++) mesh(G.box(0.9, 1.6, 0.5), mat('#5a5448'), { parent: world.scene, pos: [cx - 1.5 + i * 0.8, campH(cx, cz + 13) + 0.8, cz + 12.9], rot: [0, rnd(-0.2, 0.2), rnd(-0.1, 0.1)] });
    const photoTex = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#3a3226'; g.fillRect(0, 0, w, h);
      ['D-01 · 2001', 'D-02 · 2006', 'D-03 · 2011', 'D-04 · 2017'].forEach((lbl, i) => {
        const x = 16 + i * 124; g.fillStyle = '#d8d0b8'; g.fillRect(x, 30, 110, 150); g.fillStyle = '#6a6252'; g.fillRect(x + 6, 36, 98, 110);
        for (let k = 0; k < 5; k++) { g.fillStyle = '#2a261f'; g.beginPath(); g.arc(x + 18 + k * 18, 96, 7, 0, TAU); g.fill(); g.fillRect(x + 12 + k * 18, 104, 12, 30); }
        if (i === 2) { g.strokeStyle = '#e3a33b'; g.lineWidth = 3; g.beginPath(); g.arc(x + 54, 96, 11, 0, TAU); g.stroke(); }
        g.fillStyle = '#1a1712'; g.font = 'bold 16px Arial'; g.fillText(lbl, x + 10, 168);
      });
    });
    const photoWall = mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshLambertMaterial({ map: photoTex }), { parent: world.scene, pos: [cx - 12, campH(cx - 12, cz - 4) + 1.4, cz - 4], rot: [0, Math.PI / 2, 0], cast: false });
    mesh(G.box(0.2, 2.6, 4.4), mat('#4a3f30'), { parent: world.scene, pos: [cx - 12.15, campH(cx - 12, cz - 4) + 1.3, cz - 4] });
    const laptop = mesh(G.box(0.6, 0.05, 0.4), mat('#1a1a1a'), { parent: world.scene, pos: [cx + 4, campH(cx + 4, cz) + 0.9, cz], cast: false });
    mesh(G.box(1.8, 0.85, 1), mat('#4a4438'), { parent: world.scene, pos: [cx + 4, campH(cx + 4, cz) + 0.42, cz] }); world.circles.push({ x: cx + 4, z: cz, r: 1 });
    for (let i = 0; i < 4; i++) { const c = makeCaseModel(); c.position.set(cx - 4 + i * 1.2, campH(cx - 4, cz - 3) + 0.02, cz - 3 + (i % 2) * 0.6); c.rotation.y = rnd(-0.4, 0.4); c.userData.caps.forEach((cp) => { cp.c.visible = false; cp.ring.visible = false; }); world.add(c); }
    const fire = new THREE.PointLight('#ff9a4a', 0, 16, 1.6); fire.position.set(cx, campH(cx, cz) + 1, cz); world.add(fire);
    const fireLogs = mesh(G.cyl(0.9, 1.1, 0.25, 8), mat('#3a2a1a'), { parent: world.scene, pos: [cx, campH(cx, cz) + 0.1, cz], cast: false });
    const npc = {};
    [['lena', cx + 3, cz + 3, 2.4], ['halm', cx - 3, cz + 2, 1.2]].forEach(([k, x, z, ry]) => { const n = makeNPC(k); n.position.set(x, campH(x, z), z); n.rotation.y = ry; n.visible = false; world.add(n); npc[k] = n; });
    world.onUpdate(() => { diego.userData.pose = { crouch: S.stage !== 'camp' }; });

    const S = { stage: 'volcano', filter: 45, gasHurtT: 0, diego: false, clues: new Set(), seenEva: false, cp: 'start', reveal: false, bunker: false, core: false, mara: false };
    const P = () => Game.player;
    const inside = (x, z) => underRoof(x, z) && tunnelInfo(x, z).s < 1;
    const clueList = [
      ['barricade', cx, cz + 13.6, 'Осмотреть баррикаду', 'Шкафы придвинуты к двери изнутри. Не от животных — у животных нет дверных ручек.'],
      ['bullets', cx + 3.4, cz + 7.4, 'Осмотреть стену модуля', 'Пулевые отверстия, 9 мм. Стреляли изнутри наружу — и снаружи внутрь.'],
      ['laptop', cx + 4, cz + 0.9, 'Осмотреть сгоревший ноутбук', 'Уцелел фрагмент файла: «PROTOCOL ASH — AUTHORIZE ON 5/5 — ORIGO SEC».'],
      ['photos', cx - 10.8, cz - 4, 'Осмотреть фотостену', 'Четыре фотографии: D-01 · 2001, D-02 · 2006, D-03 · 2011, D-04 · 2017. На снимке D-03 одно лицо обведено.'],
      ['cases', cx - 2.2, cz - 2.6, 'Осмотреть кейсы', 'Четыре кейса для образцов. Все пустые. В каждом — шесть гнёзд.'],
      ['diary', cx + 8, cz + 6, 'Прочитать дневник', 'Мара Линд, запись двенадцать: «Они заложили заряды в скважины. Если архив уйдёт к ORIGO, острова не будет. Образцы я спрячу».'],
      ['radio', cx - 7, cz - 8, 'Осмотреть рацию', 'Разбита прикладом. Кто-то очень не хотел, чтобы отсюда позвонили.'],
      ['trail', cx - 14, cz + 12, 'Изучить тропу', 'Следы ботинок: один человек, туда и обратно, много раз. Месяцами. К пещерам.'],
    ];
    clueList.forEach(([id, x, z, label, text]) => world.interact({ x, z, r: 2.2, hold: 0.6, label, enabled: () => S.stage === 'camp' && !S.clues.has(id),
      onUse: () => { S.clues.add(id); Sound.sfx('ping'); HUD.say([{ who: `[Улика ${S.clues.size}/8]`, text, dur: 5 }], true); HUD.objective(`Выясните, что случилось с D-04 · ${S.clues.size}/8`, 'Осмотрите лагерь: модуль, фотостену, кейсы, тропу к пещерам.'); if (S.clues.size === 8) setTimeout(reveal, 5200); } }));
    world.interact({ x: TRUTH.core[0] + 2.4, z: TRUTH.core[1], r: 2.6, label: 'Осмотреть станцию кернов', enabled: () => !S.core,
      onUse: () => { S.core = true; Game.state.flags.clueCore = true; HUD.say([{ who: '[Керн · станция Варна]', text: 'Базальт. Возраст породы по метке Варна: 43 года. Под ним — привезённая почва, слоями.', dur: 5 }, { who: 'Хальм (рация)', text: '<em>(тихо)</em> Этот остров моложе меня.', dur: 3 }]); } });
    TRUTH.bunkers.forEach(([x, z]) => world.interact({ x, z: z + 2.4, r: 2.4, label: 'Осмотреть люк', enabled: () => !S.bunker,
      onUse: () => { S.bunker = true; HUD.say([{ who: '[Люк]', text: '«ORIGO-2017 · GEOTHERMAL WELL 7 · SEALED». Свежая пломба. Внутри что-то тикает? Нет — показалось.', dur: 5 }]); } }));
    world.interact({ x: -61, z: 26, r: 3, label: 'Изучить отпечатки', enabled: () => !Journal.has('eva', 't_prints'),
      onUse: () => { Journal.add('eva', 't_prints'); HUD.say([{ who: '[Сканер]', text: 'ОТПЕЧАТОК · 4 пальца + волочащийся коготь · вид: НЕТ СОВПАДЕНИЙ В РЕЕСТРЕ', dur: 4.6 }, { who: 'Лена (рация)', text: 'Эти следы были и в долине. Я думала, ошибка сканера.' }]); } });
    world.interact({ x: TRUTH.shelter[0] + 1, z: TRUTH.shelter[1] + 1, r: 3, hold: 1, label: 'Включить диктофон', enabled: () => !S.mara,
      onUse: () => { S.mara = true; Game.state.flags.maraFound = true; HUD.say([{ who: '[Мара Линд · последняя запись · 2019]', text: '«Лена, если ты это слышишь… я знала, что ты прилетишь. Ты всегда приходила туда, куда тебе запрещали».', dur: 6 }, { who: '[Мара Линд]', text: '«Пять образцов открывают архив. Шестой — ЕВА — позволяет выбрать, что из него выпустить. Её кожа сходит каждую весну. Под старой — живая».', dur: 7 }]); } });
    world.interact({ x: skin.position.x, z: skin.position.z, r: 2.4, hold: 1.4, label: 'Взять пробу со сброшенной кожи', enabled: () => S.mara && !Game.state.dna.eva && !DNA.busy,
      onUse: async () => { const ok = await DNA.collect('eva', true, 'EVA-0'); if (ok) { Journal.add('eva', 'dna'); Game.state.flags.sixth = true; HUD.say([{ who: 'Итан', text: 'Шестое гнездо. «Е.» — это ЕВА.', dur: 3 }]); } } });

    async function reveal() {
      S.reveal = true;
      const g = (x, z, y = 1.7) => V(x, campH(x, z) + y, z);
      npc.lena.visible = npc.halm.visible = true;
      diego.position.set(cx + 5, campH(cx + 5, cz - 4), cz - 4); diego.rotation.y = -1.8;
      await Cine.play([
        { from: g(cx - 8, cz - 7, 1.6), to: g(cx - 8.5, cz - 4, 1.6), look: g(cx - 12, cz - 4, 1.4), dur: 5, cut: true, fov: 50, onStart: () => HUD.say([{ who: 'Лена', text: 'Четыре экспедиции. Не одно «исследование». Четыре.', dur: 4 }]) },
        { from: g(cx - 10, cz - 4.6, 1.5), look: g(cx - 12, cz - 4.4, 1.4), dur: 3.4, fov: 30, onStart: () => HUD.say([{ who: 'Лена', text: 'Это вы. На фотографии D-03.', dur: 3 }]) },
        { from: g(cx + 1, cz + 5, 1.6), look: g(cx - 3, cz + 2, 1.6), dur: 3, cut: true, fov: 45, onStart: () => HUD.say([{ who: 'Хальм', text: 'Это был я.', dur: 2.4 }]) },
        { from: g(cx - 1, cz + 1, 1.6), look: g(cx + 3, cz + 3, 1.6), dur: 7, cut: true, fov: 45, onStart: () => HUD.say([{ who: 'Лена', text: 'Мара Линд. Руководитель D-04. Моя мать. Я прилетела сюда за ней, Виктор. Где она?', dur: 4.6 }, { who: 'Хальм', text: 'Я не знаю. Правда не знаю.', dur: 2.4 }]) },
        { from: g(cx + 2, cz - 1, 1.6), look: g(cx + 5, cz - 4, 1.5), dur: 6, cut: true, fov: 45, onStart: () => HUD.say([{ who: 'Диего', text: '«Протокол „Пепел“. Исполнить при пяти из пяти». Что такое «Пепел»?', dur: 3.6 }, { who: 'Хальм', text: 'Старый план. Его отменили.', dur: 2.4 }]) },
        { from: g(cx + 4, cz - 1, 1.6), look: g(cx - 3, cz + 2, 1.6), dur: 3.4, cut: true, fov: 45, onStart: () => HUD.say([{ who: 'Диего', text: 'Тогда почему он лежал запечатанный у меня в кармане?', dur: 3.2 }]) },
        { from: g(cx, cz - 6, 3), to: g(cx, cz - 7, 3.2), look: g(cx, cz + 2, 1), dur: 7, cut: true, fov: 50, onStart: () => HUD.say([{ who: 'Хальм', text: 'Без меня вы не вызовете вертолёт. Без вас я не возьму пятый образец. Можете меня ненавидеть. Но мы всё ещё нужны друг другу.', dur: 6.4 }]) },
      ], { skippable: true });
      fire.intensity = 12; fireLogs.material.emissive = new THREE.Color('#ff5a1a');
      await HUD.say([{ who: 'Диего', text: 'Я не буду стрелять в неё. В Королеву. Если придётся — я лучше стану приманкой.' }]);
      Game.complete('queen');
    }

    const ctx = {
      world,
      spawn: { x: 0, z: 134, yaw: Math.PI },
      markers() {
        const m = [];
        if (S.stage === 'volcano') m.push({ x: -60, z: 44, label: 'пещера' });
        else if (S.stage === 'cave' && !S.diego) m.push({ x: TRUTH.alcove[0], z: TRUTH.alcove[1], label: 'голос' });
        else if (S.stage === 'cave') m.push({ x: -32, z: -90, label: 'выход' });
        else if (S.stage === 'camp' && S.clues.size < 8) m.push({ x: cx, z: cz, label: 'лагерь D-04' });
        if (S.stage === 'cave' && S.diego && Journal.pct('eva') >= 50 && !S.mara) m.push({ x: TRUTH.shelter[0], z: TRUTH.shelter[1], label: '6 = ЕВА', cls: 'ark' });
        return m;
      },
      subjects() { return [{ sp: 'eva', obj: eva, size: 6, lift: 2, tag: E.state === 'listen' ? 'Слушает' : '', item: E.state === 'listen' ? 'b_sound' : null, special: true, maxDist: 60 }]; },
      async start() {
        Sound.bed('wind', 0.06); Sound.bed('hum', 0.02);
        HUD.objective('Пересеките вулканическую зону', 'Жёлтая дымка — газ: фильтр противогаза на 45 секунд. Фумаролы выбрасывают пар — не стойте рядом.');
        HUD.say([{ who: 'Лена (рация)', text: 'Итан… в кейсе второй модуль. Передатчик. Он всё это время отправлял куда-то статус образцов.' }, { who: 'Хальм (рация)', text: 'Стандартная телеметрия.' }, { who: 'Лена (рация)', text: 'Конечно.' }]);
      },
      update(dt) {
        const p = P(), pp = p.pos;
        const ins = inside(pp.x, pp.z);
        world.ceiling = ins ? 7.6 : null;
        world.hemi.intensity = damp(world.hemi.intensity, ins ? 0.06 : world.baseHemi, 2, dt);
        world.sun.intensity = ins ? 0 : world.baseSun;
        flash.intensity = ins ? 30 : 0;
        world.scene.fog.color.set(ins ? '#0a0f0e' : '#6b5a50'); world.scene.fog.far = ins ? 45 : 260; world.scene.fog.near = ins ? 4 : 30;
        // gas & vents
        if (S.stage === 'volcano') {
          const inGas = TRUTH.gas.some(([x, z, r]) => dist2d(pp.x, pp.z, x, z) < r);
          if (inGas) {
            S.filter = Math.max(0, S.filter - dt);
            HUD.timer(`ФИЛЬТР ${Math.ceil(S.filter)} с`);
            if (S.filter <= 0) { S.gasHurtT -= dt; if (S.gasHurtT <= 0) { S.gasHurtT = 3; Sound.sfx('grunt', 0.5); if (p.hurt(1) <= 0) Game.fail('Газ', 'Фильтр кончился. Обходите жёлтую дымку.', () => ctx.restore()); } }
          } else HUD.timer(S.filter < 45 ? `ФИЛЬТР ${Math.ceil(S.filter)} с` : null);
          for (const v of steamPts) if (v.burst && dist2d(pp.x, pp.z, v.x, v.z) < 2.6 && !v.hit) { v.hit = true; setTimeout(() => { v.hit = false; }, 1500); if (p.hurt(1, new THREE.Vector3(v.x, 0, v.z)) <= 0) Game.fail('Фумарола', 'Пар вырывается каждые четыре секунды', () => ctx.restore()); }
          if (inCaveRegion(pp.x, pp.z) && pp.z < 40) { S.stage = 'cave'; S.cp = 'cave'; HUD.timer(null); HUD.objective('Найдите путь через пещеры', 'Темно. Фонарь включён. Что-то большое оставило здесь четырёхпалые следы.'); HUD.say([{ who: 'Лена (рация)', text: 'Связь тут будет плохой. Итан… будьте осторожны.' }]); }
        }
        // Diego
        if (S.stage === 'cave' && !S.diego && dist2d(pp.x, pp.z, TRUTH.alcove[0], TRUTH.alcove[1]) < 7) {
          S.diego = true; S.cp = 'diego';
          HUD.say([{ who: 'Диего', text: 'Следопыт… Не свети в глаза. Я живой. Почти.' }, { who: 'Диего', text: 'Ушёл от рапторов в пещеру у джунглей, а она вывела сюда. Здесь живёт что-то огромное и бледное. Оно меня обнюхало — и ушло.' }, { who: 'Диего', text: 'Хальм дал мне конверт. «Вскрыть при пяти из пяти». Знаешь что? Я вскрою его прямо сейчас.' }, { who: 'Диего', text: '<em>(шорох бумаги)</em> …«Протокол „Пепел“». Иди вперёд. Я доползу до выхода сам.' }]);
          HUD.objective('Пересеките зал — тихо', 'Оно слепое и охотится на звук. Капель глушит шаги: двигайтесь сразу после звука капли. Присядьте.');
        }
        // drips mask steps
        dripT -= dt; maskT -= dt;
        if (dripT <= 0) { dripT = 1.8; maskT = 0.75; if (S.stage === 'cave') { Sound.sfx('drip', Sound.vol(dist2d(pp.x, pp.z, TRUTH.hall[0], TRUTH.hall[1]), 10, 60) + 0.2); } }
        // EVA
        updateEva(dt, p);
        if (S.stage === 'cave' && pp.z < -78) {
          S.stage = 'camp'; S.cp = 'camp';
          HUD.objective('Выясните, что случилось с D-04 · 0/8', 'Лагерь Линд на краю кальдеры. Осмотрите всё.');
          HUD.say([{ who: 'Лена (рация)', text: 'Итан, мы видим вас. Мы у лагеря… Это лагерь D-04.' }]);
          npc.lena.visible = npc.halm.visible = true;
          diego.position.set(cx + 5, campH(cx + 5, cz - 4), cz - 4);
        }
      },
      restore() {
        HUD.timer(null);
        const at = { start: [0, 134, Math.PI], cave: [-60, 36, Math.PI], diego: [-70, 4, -2.4], camp: [-32, -92, Math.PI] }[S.cp] || [0, 134, Math.PI];
        Game.player.place(at[0], at[1], at[2]);
        S.filter = Math.max(S.filter, 25);
        E.state = 'roam'; E.x = TRUTH.hall[0] - 10; E.z = TRUTH.hall[1] - 8;
      },
    };
    function updateEva(dt, p) {
      const pp = p.pos;
      const d = dist2d(pp.x, pp.z, E.x, E.z);
      const hearR = maskT > 0 ? 0 : p.noise * 2.4;
      let speed = 0, tx = E.target.x, tz = E.target.z;
      if (!S.seenEva && d < 26 && S.stage === 'cave') {
        S.seenEva = true; Journal.add('eva', 'seen');
        Cam.pull = { x: E.x, z: E.z, strength: 2, time: 2 };
        Sound.silenceAll(0.5); setTimeout(() => Sound.bed('hum', 0.02), 6000);
        HUD.say([{ who: '[Сканер]', text: 'SPECIES: UNKNOWN — NO MATCH IN REGISTRY', dur: 3 }, { who: 'Итан', text: '<em>(шёпотом)</em> Так вот кто оставлял эти следы.', dur: 3 }]);
      }
      if (S.stage === 'cave' && hearR > 0 && d < hearR) {
        if (E.state !== 'hunt') { E.state = 'listen'; E.t = 0.9; Sound.sfx('click', 0.7); if (d < 26) Journal.add('eva', 'b_sound'); }
        E.target = { x: pp.x, z: pp.z };
      }
      if (E.state === 'roam') {
        speed = 1.3;
        if (dist2d(E.x, E.z, tx, tz) < 1.5) { const a = rnd(0, TAU), r = rnd(0, 15); E.target = { x: TRUTH.hall[0] + Math.cos(a) * r, z: TRUTH.hall[1] + Math.sin(a) * r }; }
      } else if (E.state === 'listen') {
        E.t -= dt; speed = 0; E.yaw = dampAngle(E.yaw, Math.atan2(E.target.x - E.x, E.target.z - E.z), 4, dt);
        if (E.t <= 0) E.state = 'hunt';
      } else if (E.state === 'hunt') {
        speed = 4.6;
        if (dist2d(E.x, E.z, tx, tz) < 1.5) { E.state = 'roam'; E.target = { x: E.x + rnd(-4, 4), z: E.z + rnd(-4, 4) }; }
      }
      if (speed > 0) {
        const dx = tx - E.x, dz = tz - E.z, dd = Math.hypot(dx, dz);
        if (dd > 0.2) { let nx = E.x + (dx / dd) * speed * dt, nz = E.z + (dz / dd) * speed * dt; if (tunnelInfo(nx, nz).s < -1 || dist2d(nx, nz, TRUTH.hall[0], TRUTH.hall[1]) < 20) { E.x = nx; E.z = nz; } else E.target = { x: TRUTH.hall[0], z: TRUTH.hall[1] }; E.yaw = dampAngle(E.yaw, Math.atan2(dx, dz), 3, dt); }
      }
      if (S.stage === 'cave' && d < 2.8) { Sound.sfx('roar', 0.8); Game.fail('ЕВА', 'Она слышит каждый шаг. Двигайтесь сразу после капли.', () => ctx.restore()); }
      eva.position.set(E.x, truthH(E.x, E.z), E.z); eva.rotation.y = E.yaw;
      eva.userData.anim(dt, speed, { listen: E.state === 'listen', drink: E.state === 'roam' && Math.sin(Game.time * 0.3) > 0.7 });
    }
    return ctx;
  },
};
