// ============================================================
// 48-ch-queen.js — Chapter VI: T-Rex territory & Site Zero, DNA 5
// ============================================================
function queenH(x, z) {
  let h = 1.5 + fbm(x * 0.018, z * 0.018, 4) * 5;
  const ds = Math.hypot(x, z - 6);
  h = lerp(0, h, smoothstep(40, 62, ds));
  h += smoothstep(160, 210, Math.hypot(x, z - 60)) * 40;
  return h;
}

CHAPTERS.queen = {
  create() {
    seed(6666);
    const world = new World({ bounds: { x: 0, z: 60, r: 165 } });
    applyTime(world, 'storm');
    world.scene.fog.near = 18; world.scene.fog.far = 150;
    world.hemi.intensity = world.baseHemi = 1.05;
    makeTerrain(world, { size: 400, seg: 150, cx: 0, cz: 60, height: queenH, color: (x, z, y, s, c) => { c.set('#2f3a26').lerp(_tmpC.set('#3a3a2a'), fbm(x * 0.05, z * 0.05, 2) * 0.5 + 0.5); if (Math.hypot(x, z - 6) < 48) c.set('#3a3b36'); if (s > 0.35) c.lerp(_tmpC.set('#4a4a42'), 0.5); } });
    world.floor = (x, z) => (x > -34 && x < 34 && z > -26 && z < 34 ? 0 : world.terrain.sample(x, z));
    world.snapY = true;
    makeRain(world);
    const H = queenH;
    // broken forest & carcasses
    scatterInstanced(world, deadTreeGeo(), vegMat(0.003), scatter(QUALITY ? 140 : 80, () => { const x = rnd(-150, 150), z = rnd(30, 220); if (Math.hypot(x, z - 6) < 55) return null; return { x, y: H(x, z) - 0.2, z, s: rnd(1, 1.8), ry: rnd(0, TAU), tilt: rnd(-0.6, 0.6), tiltZ: rnd(-0.5, 0.5) }; }), { cast: true });
    scatterInstanced(world, coniferGeo(), vegMat(0.003), scatter(QUALITY ? 200 : 110, () => { const x = rnd(-200, 200), z = rnd(-80, 240); if (Math.hypot(x, z - 60) < 120) return null; return { x, y: H(x, z), z, s: rnd(1.5, 2.5), ry: rnd(0, TAU) }; }), { cast: false });
    makeFerns(world, scatter(QUALITY ? 1100 : 550, () => { const x = rnd(-150, 150), z = rnd(30, 220); if (Math.hypot(x, z - 6) < 50) return null; return { x, y: H(x, z) - 0.05, z, s: rnd(0.8, 1.6), ry: rnd(0, TAU), tint: pick(['#4a6a36', '#56703a']) }; }));
    const carcasses = [[-30, 110], [48, 76]];
    carcasses.forEach(([x, z]) => makeCarcass(world, x, z));
    const muds = [[20, 120], [-46, 80], [34, 58]];
    muds.forEach(([x, z]) => mesh(new THREE.CircleGeometry(3.2, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a2e22', roughness: 0.2 }), { parent: world.scene, pos: [x, H(x, z) + 0.05, z], cast: false }));
    for (let i = 0; i < 10; i++) { const x = rnd(-60, 60), z = rnd(40, 140); decal(world, x, z, { size: 2.2, ry: rnd(0, TAU) }); }
    // ---------- Site Zero ----------
    const wallM = mat('#5b5e58', { rough: 0.95 });
    buildWalls(world, [
      [-32, 0, -32, 32], [32, 0, 32, 32], [-32, 32, -4, 32], [4, 32, 32, 32], [-32, 0, -20, 0], [20, 0, 32, 0],
      [-20, 0, -6, 0], [6, 0, 10, 0], [14, 0, 20, 0],
      [-20, -24, 20, -24], [20, -24, 20, 0], [-20, -24, -20, -14], [-20, -10, -20, 0],
      [-28, -18, -20, -18], [-28, -6, -20, -6], [-28, -18, -28, -6],
      [-29, 4, -29, 28], [29, 4, 29, 28],
    ], { mat: wallM, h: 5 });
    mesh(G.box(41, 0.5, 25), mat('#3e413c'), { parent: world.scene, pos: [0, 5.2, -12], cast: false });
    mesh(G.box(9, 0.5, 13), mat('#3e413c'), { parent: world.scene, pos: [-24, 5.2, -12], cast: false });
    mesh(G.box(66, 0.1, 58), mat('#333530', { rough: 0.9 }), { parent: world.scene, pos: [0, -0.03, 4], receive: true, cast: false });
    const glassM = new THREE.MeshStandardMaterial({ color: '#8fb0c0', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28 });
    const breach = new Door(world, { x0: -6, z0: 0, x1: 6, z1: 0, h: 5, mat: glassM });
    breach.box.seeThrough = true;
    const labDoor = new Door(world, { x0: 10, z0: 0, x1: 14, z1: 0, h: 5, color: '#50554f', stripe: true });
    const arkDoor = new Door(world, { x0: -20, z0: -14, x1: -20, z1: -10, h: 5, color: '#6a6e66', stripe: true, speed: 3 });
    const gate = new Door(world, { x0: -4, z0: 32, x1: 4, z1: 32, h: 5, color: '#4b4f49', stripe: true });
    [[-15, 10], [15, 10], [-15, 22], [15, 22], [-6, 27], [6, 27]].forEach(([x, z]) => { mesh(G.box(1.6, 5, 1.6), wallM, { parent: world.scene, pos: [x, 2.5, z], receive: true }); world.boxes.push({ x0: x - 0.8, x1: x + 0.8, z0: z - 0.8, z1: z + 0.8 }); });
    // lab interior
    const lab = new THREE.Group(); world.add(lab);
    [[-12, -16], [0, -18], [12, -16], [-8, -6], [8, -6]].forEach(([x, z]) => { mesh(G.box(3.4, 0.9, 1.4), mat('#4a4f4a', { metal: 0.3 }), { parent: lab, pos: [x, 0.45, z] }); world.boxes.push({ x0: x - 1.7, x1: x + 1.7, z0: z - 0.7, z1: z + 0.7, low: true }); });
    mesh(G.box(2, 0.9, 1.2), mat('#5a4f40'), { parent: lab, pos: [0, 0.45, -9] }); world.boxes.push({ x0: -1, x1: 1, z0: -9.6, z1: -8.4, low: true });
    const glass = mesh(G.cyl(0.09, 0.08, 0.22, 12), new THREE.MeshStandardMaterial({ color: '#cfe6f0', transparent: true, opacity: 0.4, roughness: 0.05 }), { parent: lab, pos: [0.3, 1.01, -9], cast: false });
    const water = mesh(G.cyl(0.082, 0.082, 0.01, 16), new THREE.MeshStandardMaterial({ color: '#9cc6d8', roughness: 0.05, metalness: 0.3 }), { parent: lab, pos: [0.3, 1.08, -9], cast: false });
    const papers = mesh(G.box(0.6, 0.02, 0.4), mat('#e0dccc'), { parent: lab, pos: [-0.4, 0.92, -9], cast: false });
    const labLights = [[-10, -12], [10, -12], [0, -4]].map(([x, z]) => { const l = new THREE.PointLight('#ff3a2a', 10, 18, 1.6); l.position.set(x, 4.4, z); world.add(l); return l; });
    // station S-5
    const st = new THREE.Group(); st.position.set(0, 0, 14); world.add(st);
    for (const s of [-1, 1]) { mesh(G.box(0.6, 7, 0.6), mat('#6a5a3a', { metal: 0.4 }), { parent: st, pos: [s * 4, 3.5, 0] }); world.boxes.push({ x0: s * 4 - 0.3, x1: s * 4 + 0.3, z0: 13.7, z1: 14.3 }); }
    mesh(G.box(8.6, 0.5, 0.6), mat('#6a5a3a', { metal: 0.4 }), { parent: st, pos: [0, 7, 0] });
    const jawL = mesh(G.box(0.3, 1.6, 2.4), mat('#8a8a82', { metal: 0.6 }), { parent: st, pos: [-2.6, 5.2, 0] });
    const jawR = mesh(G.box(0.3, 1.6, 2.4), mat('#8a8a82', { metal: 0.6 }), { parent: st, pos: [2.6, 5.2, 0] });
    const hook = mesh(G.box(0.2, 1.6, 0.2), mat('#333'), { parent: st, pos: [0, 5.6, 1.6] });
    const bait = makeCarcass(world, 0, 15.6); bait.scale.setScalar(0.5); bait.visible = false; world.circles.pop();
    const capsule = mesh(G.cyl(0.1, 0.1, 0.4, 10), new THREE.MeshStandardMaterial({ color: '#9fe0b0', emissive: new THREE.Color('#2aff7a'), emissiveIntensity: 1.2 }), { parent: world.scene, pos: [1.4, 0.2, 15.4], rot: [0, 0, Math.PI / 2], cast: false });
    capsule.visible = false;
    const switches = [[-30.5, 26], [30.5, 8]].map(([x, z]) => { const g = new THREE.Group(); mesh(G.box(0.8, 1.2, 0.3), mat('#3a3f42', { metal: 0.5 }), { parent: g, pos: [0, 1.3, 0] }); const led = mesh(G.sphere(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: '#551111' }), { parent: g, pos: [0, 1.7, 0.18], cast: false }); g.position.set(x, 0, z); g.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; world.add(g); return { x, z, led, on: false }; });
    const lever = new THREE.Group(); mesh(G.box(0.5, 1, 0.5), mat('#3a3f42'), { parent: lever, pos: [0, 0.5, 0] }); const leverArm = mesh(G.box(0.1, 0.9, 0.1), mat('#b83a2a'), { parent: lever, pos: [0, 1.3, 0], rot: [0.5, 0, 0] }); lever.position.set(-9, 0, 18); world.add(lever); world.circles.push({ x: -9, z: 18, r: 0.5 });
    // companions (appear in the lab)
    const npc = {};
    [['lena', -4, -12, 0.4], ['halm', 4, -13, -0.3], ['diego', -8, -10, 0.9]].forEach(([k, x, z, ry]) => { const n = makeNPC(k); n.position.set(x, 0, z); n.rotation.y = ry; n.visible = false; world.add(n); npc[k] = n; });
    // ---------- the Queen ----------
    const rex = makeRex(); world.add(rex);
    const patrol = [[40, 110], [-50, 120], [-70, 60], [60, 50], [10, 150]];
    const Q = { x: 40, z: 110, yaw: 0, state: 'roam', speed: 0, t: 0, target: { x: -50, z: 120 }, pi: 1, cool: 0, stuck: 0, lastPos: { x: 40, z: 110 }, held: 0, eat: 0 };
    rex.userData.stepCb = () => { const d = dist2d(Game.player.pos.x, Game.player.pos.z, Q.x, Q.z); const v = Sound.vol(d, 8, 140); Sound.sfx('step', v); if (d < 40) Cam.shake = Math.max(Cam.shake, 0.25 * v); };
    let flashT = 0, nextFlash = 5, windT = 40;
    world.wind.set(0.6, -0.8).normalize();
    const S = { stage: 'territory', scentMask: 0, cp: 'start', switches: 0, bait: false, dna: false, seen: false, scentLearn: 0, glassDone: false };
    const P = () => Game.player;
    const ctx = {
      world,
      spawn: { x: 0, z: 162, yaw: Math.PI },
      markers() {
        const pp = P().pos, m = [{ x: pp.x + world.wind.x * 50, z: pp.z + world.wind.y * 50, label: 'ветер ↦' }];
        if (S.stage === 'territory') m.push({ x: 0, z: 32, label: 'Объект-0' });
        else if (S.stage === 'site') m.push({ x: 0, z: -9, label: 'лаборатория' });
        else if (S.stage === 'chase' && S.switches < 2) switches.filter((s) => !s.on).forEach((s) => m.push({ x: s.x, z: s.z, label: 'рубильник' }));
        else if (S.stage === 'chase' && !S.bait) m.push({ x: 0, z: 16, label: 'кран' });
        else if (S.stage === 'chase') m.push({ x: -9, z: 18, label: 'рычаг', cls: 'bad' });
        else if (S.stage === 'escape') m.push({ x: -20, z: -12, label: 'Ковчег', cls: 'ark' });
        return m;
      },
      subjects() { return [{ sp: 'rex', obj: rex, size: 12, lift: 4, tag: Q.state === 'track' ? 'Идёт по запаху' : '', item: Q.state === 'track' ? 'b_scent' : null, special: true, maxDist: 150 }]; },
      async start() {
        Sound.bed('rain', 0.14); Sound.bed('wind', 0.1);
        HUD.objective('Пересеките территорию Королевы', 'Она чует по ветру. Смотрите на компас: запах уходит туда, куда дует ветер. Грязь скрывает запах.');
        HUD.say([{ who: 'Лена', text: 'Слышите? Насекомых нет. Совсем.' }, { who: 'Хальм', text: 'Здесь почти нет других хищников. Причина очевидна.' }, { who: 'Хальм', text: 'Держитесь так, чтобы ветер дул вам в лицо. Тогда она вас не учует.' }]);
      },
      update(dt) {
        const p = P(), pp = p.pos;
        // storm
        nextFlash -= dt; flashT -= dt;
        if (nextFlash <= 0) { nextFlash = rnd(7, 13); flashT = 0.45; lightning(world, 1, rnd(0.5, 1.6)); }
        windT -= dt;
        if (windT <= 0 && S.stage === 'territory') { windT = rnd(35, 50); const a = rnd(0, TAU); world.wind.set(Math.cos(a), Math.sin(a)); HUD.say([{ who: 'Лена (рация)', text: 'Ветер сменился! Смотрите на компас.' }]); }
        S.scentMask -= dt;
        if (S.scentMask > 0) HUD.timer(`ЗАПАХ СКРЫТ · ${Math.ceil(S.scentMask)} с`); else if (S.stage === 'territory') HUD.timer(null);
        updateRex(dt, p);
        if (S.stage === 'territory' && pp.z < 31 && Math.abs(pp.x) < 30) {
          S.stage = 'site'; S.cp = 'gate'; HUD.timer(null);
          Q.state = 'off'; Q.x = -120; Q.z = 200;
          gate.set(false);
          Object.values(npc).forEach((n) => { n.visible = true; });
          HUD.objective('Осмотрите лабораторию Объекта-0', 'Вход — дверь с жёлтой полосой справа. Здесь погибла экспедиция D-03.');
          HUD.say([{ who: 'Хальм', text: 'Объект-0. Самое старое здание на острове.' }]);
          labDoor.set(true);
        }
      },
      restore() {
        HUD.timer(null); HUD.danger(false);
        const at = { start: [0, 162, Math.PI], gate: [12, 6, Math.PI], chase: [12, 4, Math.PI], dna: [0, -6, 0] }[S.cp] || [0, 162, Math.PI];
        Game.player.place(at[0], at[1], at[2]);
        if (S.stage === 'territory') { Q.state = 'roam'; Q.x = 40; Q.z = 110; }
        if (S.stage === 'chase' || S.stage === 'escape') { Q.state = 'hunt'; Q.x = 0; Q.z = 26; Q.cool = 3; Q.held = 0; Q.eat = 0; }
      },
      dispose() { HUD.timer(null); },
      debug: () => ({ q: { ...Q }, s: { stage: S.stage, bait: S.bait, sw: S.switches } }),
    };
    function rexCollide() {
      const r = 2.4;
      for (const b of world.boxes) { if (b.off) continue; if (Q.x > b.x0 - r && Q.x < b.x1 + r && Q.z > b.z0 - r && Q.z < b.z1 + r) { const pl = Q.x - (b.x0 - r), pr = b.x1 + r - Q.x, pb = Q.z - (b.z0 - r), pf = b.z1 + r - Q.z; const m = Math.min(pl, pr, pb, pf); if (m === pl) Q.x = b.x0 - r; else if (m === pr) Q.x = b.x1 + r; else if (m === pb) Q.z = b.z0 - r; else Q.z = b.z1 + r; } }
    }
    function updateRex(dt, p) {
      const pp = p.pos;
      const d = dist2d(pp.x, pp.z, Q.x, Q.z);
      let tx = Q.target.x, tz = Q.target.z, speed = 0;
      const st = { roar: false, sniff: false, open: false, look: 0 };
      if (Q.state === 'off') { rex.visible = false; return; }
      rex.visible = true;
      if (S.stage === 'territory') {
        const tr = { x: (Q.x - pp.x) / (d || 1), z: (Q.z - pp.z) / (d || 1) };
        const scent = S.scentMask <= 0 && d < 110 && world.wind.x * tr.x + world.wind.y * tr.z > 0.82;
        const sight = d < (flashT > 0 ? 60 : 20) * (p.crouch ? 0.7 : 1);
        const hear = p.noise > 0 && d < p.noise * 2.2;
        if (sight && Q.state !== 'hunt') { Q.state = 'hunt'; Sound.sfx('roar', Sound.vol(d, 10, 150)); if (!S.seen) { S.seen = true; Journal.add('rex', 'seen'); } }
        else if ((scent || hear) && Q.state === 'roam') { Q.state = 'track'; Q.t = 0; Sound.sfx('grunt', Sound.vol(d, 10, 120)); Q.target = { x: pp.x, z: pp.z }; HUD.say([{ who: 'Лена (рация)', text: scent ? 'Она повернула к вам… Итан, она вас учуяла! Уходите с ветра!' : 'Она вас слышит. Тише!' }], true); }
        if (Q.state === 'track') { S.scentLearn += dt; if (S.scentLearn > 8) Journal.add('rex', 'b_scent'); }
      }
      if (Q.state === 'roam') {
        speed = 2.6;
        if (dist2d(Q.x, Q.z, tx, tz) < 4) { Q.pi = (Q.pi + 1) % patrol.length; Q.target = { x: patrol[Q.pi][0], z: patrol[Q.pi][1] }; }
      } else if (Q.state === 'track') {
        speed = 4; st.sniff = true; Q.t += dt;
        if (Q.t > 3) { Q.t = 0; const tr2 = { x: (Q.x - pp.x) / (d || 1), z: (Q.z - pp.z) / (d || 1) }; if (S.scentMask <= 0 && world.wind.x * tr2.x + world.wind.y * tr2.z > 0.7) Q.target = { x: pp.x, z: pp.z }; else if (dist2d(Q.x, Q.z, tx, tz) < 5) { Q.state = 'roam'; Q.target = { x: patrol[Q.pi][0], z: patrol[Q.pi][1] }; } }
      } else if (Q.state === 'hunt') {
        speed = S.stage === 'territory' ? 5.8 : 5.4; st.open = d < 10;
        tx = pp.x; tz = pp.z;
        if (S.stage === 'territory' && d > 70) { Q.state = 'roam'; }
        if (S.bait && Q.eat <= 0 && Q.held <= 0 && (d > 12 || !losClear(world, Q.x, Q.z, pp.x, pp.z))) { Q.state = 'bait'; }
      } else if (Q.state === 'bait') {
        tx = 0; tz = 16.5; speed = 4.5; st.sniff = true;
        if (dist2d(Q.x, Q.z, 0, 16.5) < 3) { Q.state = 'eat'; Q.eat = 8; HUD.objective('Рычаг! Сейчас!', 'Она у приманки. Рычаг захвата — у колонны слева от станции.'); HUD.say([{ who: 'Лена', text: 'Она ест! Итан, рычаг!' }], true); }
        if (d < 8 && losClear(world, Q.x, Q.z, pp.x, pp.z)) Q.state = 'hunt';
      } else if (Q.state === 'eat') {
        Q.eat -= dt; st.sniff = true; speed = 0; Q.yaw = dampAngle(Q.yaw, Math.PI, 3, dt);
        if (Q.eat <= 0) { Q.state = 'hunt'; S.bait = false; bait.visible = false; HUD.objective('Подвесьте новую приманку', 'Она съела тушу. В морозильнике станции есть ещё — у крана.'); }
      } else if (Q.state === 'held') {
        Q.held -= dt; st.roar = Math.sin(Game.time * 3) > 0; speed = 0;
        jawL.position.x = damp(jawL.position.x, -0.9, 8, dt); jawR.position.x = damp(jawR.position.x, 0.9, 8, dt);
        if (Math.random() < dt * 1.5) { Sound.sfx('roar', 0.8); Cam.shake = Math.max(Cam.shake, 0.3); }
        if (Q.held <= 0) { Q.state = 'hunt'; Q.cool = 1.5; Sound.sfx('crack', 1); jawL.position.x = -2.6; jawR.position.x = 2.6; jawL.rotation.z = 0.6; }
      } else if (Q.state === 'recover') {
        Q.t -= dt; st.roar = Q.t > 1.2; speed = 0;
        if (Q.t <= 0) Q.state = 'hunt';
      }
      if (speed > 0) {
        const dx = tx - Q.x, dz = tz - Q.z, dd = Math.hypot(dx, dz);
        if (dd > 0.5) { Q.x += (dx / dd) * Math.min(speed, dd) * dt; Q.z += (dz / dd) * Math.min(speed, dd) * dt; Q.yaw = dampAngle(Q.yaw, Math.atan2(dx, dz), 2.6, dt); }
        rexCollide();
        Q.stuck += dt;
        if (Q.stuck > 2) { if (dist2d(Q.x, Q.z, Q.lastPos.x, Q.lastPos.z) < 1 && Q.state === 'hunt') { const nodes = [[0, 28], [-20, 28], [20, 28], [-20, 6], [20, 6], [0, 6]]; const n = pick(nodes); Q.target = { x: n[0], z: n[1] }; Q.state = 'detour'; Q.t = 2.5; } Q.stuck = 0; Q.lastPos = { x: Q.x, z: Q.z }; }
      }
      if (Q.state === 'detour') { Q.t -= dt; const dx = Q.target.x - Q.x, dz = Q.target.z - Q.z, dd = Math.hypot(dx, dz); if (dd > 1) { Q.x += (dx / dd) * 5 * dt; Q.z += (dz / dd) * 5 * dt; Q.yaw = dampAngle(Q.yaw, Math.atan2(dx, dz), 3, dt); rexCollide(); } if (Q.t <= 0) Q.state = 'hunt'; speed = 5; }
      // bite
      Q.cool -= dt;
      if ((Q.state === 'hunt' || Q.state === 'track') && d < 4.2 && Q.cool <= 0) {
        Q.cool = 2.6; Sound.sfx('roar', 1); Cam.shake = 0.9;
        const left = p.hurt(1, new THREE.Vector3(Q.x, 0, Q.z));
        Q.state = 'recover'; Q.t = 1.8;
        if (left <= 0) Game.fail('Королева', S.stage === 'territory' ? 'Идите против ветра. Грязь скрывает запах на полторы минуты.' : 'Узкие проходы у стен — туда она не пролезет.', () => ctx.restore());
      }
      Q.speed = damp(Q.speed, speed, 4, dt);
      rex.position.set(Q.x, world.groundH(Q.x, Q.z), Q.z); rex.rotation.y = Q.yaw;
      st.look = clamp(wrapAngle(Math.atan2(pp.x - Q.x, pp.z - Q.z) - Q.yaw), -0.5, 0.5);
      rex.userData.anim(dt, Q.speed, st);
      HUD.danger((Q.state === 'hunt' || Q.state === 'track') && d < 40);
    }
    // ---------- interactions ----------
    muds.forEach(([x, z]) => world.interact({ x, z, r: 3.4, hold: 1.2, label: 'Вываляться в грязи (скрыть запах)', enabled: () => S.stage === 'territory' && S.scentMask < 20, onUse: () => { S.scentMask = 90; Sound.sfx('splash', 0.5); HUD.toast('Запах скрыт на 90 секунд'); } }));
    world.interact({ x: 0, z: -7.8, r: 2.2, hold: 1, label: 'Прочитать записи D-03', enabled: () => S.stage === 'site' && !S.glassDone,
      onUse: async () => {
        S.glassDone = true; Journal.add('rex', 't_prints', true);
        Sound.silenceAll(0.3); Sound.bed('rain', 0.1);
        let ripple = 0;
        const rip = world.onUpdate((dt) => { ripple = Math.max(0, ripple - dt * 1.5); water.scale.set(1 + Math.sin(Game.time * 40) * 0.05 * ripple, 1, 1 + Math.cos(Game.time * 37) * 0.05 * ripple); water.position.y = 1.08 + Math.sin(Game.time * 50) * 0.004 * ripple; });
        const boom = () => { ripple = 1; Sound.sfx('step', 1); Cam.shake = 0.3; labLights.forEach((l) => { l.intensity = 4; setTimeout(() => { l.intensity = 10; }, 120); }); };
        await Cine.play([
          { from: V(1.4, 1.5, -9.6), look: V(0.3, 1.0, -9), dur: 3, cut: true, fov: 35, onStart: () => HUD.say([{ who: '[Журнал D-03 · 2011]', text: '«Она ходит вокруг здания. Мы слышим её, но не видим. Виктор говорит — не смотреть в окна».', dur: 3 }]) },
          { from: V(0.9, 1.25, -9.3), look: V(0.3, 1.05, -9), dur: 2.2, fov: 28, onStart: () => setTimeout(boom, 600) },
          { from: V(3, 1.7, -14), look: V(0, 1.6, -11), dur: 2.4, cut: true, fov: 45, onStart: () => HUD.say([{ who: 'Хальм', text: '<em>(шёпотом)</em> …раз… два…', dur: 2 }]) },
          { from: V(0.9, 1.25, -9.3), look: V(0.3, 1.05, -9), dur: 1.8, cut: true, fov: 28, onStart: () => setTimeout(boom, 400) },
          { from: V(0, 1.7, -6), to: V(0, 1.7, -4.5), look: V(0, 2.2, 6), dur: 3.2, cut: true, fov: 50, onStart: () => HUD.say([{ who: 'Лена', text: 'Что вы считаете?', dur: 1.6 }, { who: 'Хальм', text: 'Сколько у нас времени.', dur: 1.8 }]) },
          { from: V(0, 1.7, -4.5), look: V(0, 3, 10), dur: 1.6, fov: 50, onStart: () => { Q.state = 'staged'; Q.x = 6; Q.z = 13; Q.yaw = -Math.PI / 2; rex.visible = true; rex.position.set(Q.x, 0, Q.z); rex.rotation.y = Q.yaw; rex.userData.anim(0.016, 0, { sniff: false }); setTimeout(() => { lightning(world, 1.3, 0.2); Journal.add('rex', 'seen'); }, 200); } },
          { from: V(0, 1.7, -4.4), look: V(0, 3, 10), dur: 2.2, fov: 50, onStart: () => { setTimeout(() => { rex.visible = false; Q.x = 60; Q.z = 60; lightning(world, 1, 0.1); }, 900); } },
          { from: V(0, 1.7, -4.3), to: V(0, 1.7, -3.8), look: V(0, 2.5, 10), dur: 3.6, fov: 50, onStart: () => HUD.say([{ who: 'Диего', text: 'Ушла?', dur: 1.4 }, { who: 'Хальм', text: 'Она никогда не уходит.', dur: 2 }]) },
          { from: V(3, 2.2, -8), look: V(0, 3, 0.5), dur: 2.4, cut: true, fov: 55, onStart: () => {
            Q.x = 0; Q.z = 1.8; Q.yaw = Math.PI; Q.state = 'staged'; rex.visible = true; rex.position.set(0, 0, 1.8); rex.rotation.y = Math.PI;
            breach.mesh.visible = false; breach.box.off = true; breach.open = true;
            Sound.sfx('glass', 1); Sound.sfx('crack', 1); Sound.sfx('roar', 1.2); Cam.shake = 1.2;
            for (let i = 0; i < 14; i++) { const sh = mesh(G.box(rnd(0.3, 1), rnd(0.3, 1), 0.04), glassM, { parent: world.scene, pos: [rnd(-5, 5), rnd(0.5, 4), 0], cast: false }); let vy = rnd(1, 3), vz = -rnd(3, 7); const fn = world.onUpdate((dt) => { vy -= 9.8 * dt; sh.position.y = Math.max(0.02, sh.position.y + vy * dt); sh.position.z += vz * dt; vz *= 0.97; sh.rotation.x += dt * 5; if (sh.position.y <= 0.02) world.updaters.splice(world.updaters.indexOf(fn), 1); }); }
            HUD.say([{ who: 'Хальм', text: 'БЕГИТЕ!', dur: 1.6 }]);
          }, onUpdate: () => rex.userData.anim(0.016, 0, { roar: true }) },
        ], { skippable: false });
        world.updaters.splice(world.updaters.indexOf(rip), 1);
        Object.values(npc).forEach((n) => { n.visible = false; });
        Q.state = 'recover'; Q.t = 1.2; Q.cool = 2;
        S.stage = 'chase'; S.cp = 'chase';
        Sound.bed('drone', 0.06);
        HUD.objective('Включите питание станции S-5 · 0/2', 'Рубильники — в узких проходах у западной и восточной стен двора. Туда она не пролезет.');
        HUD.say([{ who: 'Лена (рация)', text: 'Мы в коридоре, все живы! Итан — станция S-5 во дворе! Варн строил её для неё — включите питание!' }]);
      } });
    switches.forEach((s, i) => world.interact({ x: s.x, z: s.z, r: 1.8, hold: 1, label: 'Включить рубильник', enabled: () => S.stage === 'chase' && !s.on,
      onUse: () => { s.on = true; s.led.material.color.set('#3aff7a'); S.switches++; Sound.sfx('lever', 1); Sound.sfx('gen', 0.6);
        if (S.switches < 2) HUD.objective('Включите питание станции S-5 · 1/2', 'Второй рубильник — у противоположной стены двора.');
        else { HUD.objective('Подвесьте приманку на кран', 'Туша из морозильника станции. Кран — над захватом в центре двора.'); HUD.say([{ who: 'Лена (рация)', text: 'Станция ожила! Нужна приманка — иначе она к ней не подойдёт.' }]); } } }));
    world.interact({ x: 0, z: 17.8, r: 2.2, hold: 1.2, label: 'Подвесить тушу на кран', enabled: () => S.stage === 'chase' && S.switches >= 2 && !S.bait && Q.state !== 'held',
      onUse: () => { S.bait = true; bait.visible = true; Sound.sfx('lever'); HUD.objective('Заманите её в захват', 'Спрячьтесь за колоннами — без вас в поле зрения она пойдёт к приманке. Рычаг — у колонны слева.'); } });
    world.interact({ x: -9, z: 18.8, r: 1.9, label: 'Дёрнуть рычаг захвата', enabled: () => S.stage === 'chase' && S.switches >= 2,
      warn: () => (Q.state !== 'eat' ? 'Рано — она должна быть в захвате' : null),
      onUse: () => {
        Q.state = 'held'; Q.held = 5; S.bait = false; bait.visible = false;
        leverArm.rotation.x = -0.5; Sound.sfx('slam', 1.2); Sound.sfx('roar', 1.2); Cam.shake = 1;
        Cam.pull = { x: 0, z: 15, strength: 4, time: 1.2 };
        setTimeout(() => { capsule.visible = true; Sound.sfx('ping'); }, 900);
        HUD.objective('Хватайте капсулу!', 'Капсула станции упала в грязь у её лап. У вас секунды.');
      } });
    world.interact({ x: 1.4, z: 15.4, r: 2.4, label: 'Схватить капсулу', enabled: () => capsule.visible && !S.dna,
      onUse: async () => {
        S.dna = true; capsule.visible = false;
        S.stage = 'escape'; S.cp = 'dna';
        const ok = await DNA.collect('rex', true, 'TYRANNOSAURUS REX');
        if (!ok) return;
        Journal.add('rex', 'dna');
        HUD.big('MISSION OBJECTIVE COMPLETE', 'GENETIC SAMPLES: 5/5', 'ok', 3.5);
        arkDoor.set(true);
        HUD.objective('К гермодвери Ковчега!', 'Западное крыло лаборатории, через пролом. Бегите!');
        HUD.say([{ who: 'Лукас (рация)', text: 'Следопыт? Следопыт, скажи, что ты жив.' }, { who: 'Итан', text: 'Жив. И у нас пять из пяти.' }]);
      } });
    world.interact({ x: -22, z: -12, r: 2.6, label: 'Войти в Ковчег', enabled: () => S.stage === 'escape' && arkDoor.open && !DNA.busy,
      onUse: async () => {
        S.stage = 'done'; arkDoor.set(false); Sound.sfx('slam', 1.2);
        Q.state = 'staged'; Q.x = -16; Q.z = -12;
        setTimeout(() => { Sound.sfx('thud', 1); Cam.shake = 1; Sound.sfx('roar', 0.6); }, 700);
        HUD.danger(false);
        await HUD.say([{ who: 'Хальм', text: 'Вставь их. И что бы ты ни увидел — я пытался сделать правильно.' }]);
        Game.complete('dawn');
      } });
    return ctx;
  },
};
