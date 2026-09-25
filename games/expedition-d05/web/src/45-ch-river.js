// ============================================================
// 45-ch-river.js — Chapter III: swamp & great river, DNA 3 — Spinosaurus
// plus the night-attack interlude at camp Echo
// ============================================================
const RIVER = {
  pools: [[-18, 112, 9], [24, 88, 10], [-40, 72, 8]],
  pier: { x: 20, z0: 3, z1: -12 },
  station: [42, 12],
  dam: { x0: 88, x1: 92, z0: -44, z1: 4, gz0: -24, gz1: -16 },
  shelf: [111, -5],
  riverZ: (x) => -20 + Math.sin(x * 0.012) * 4,
};
function riverH(x, z) {
  let h = 1.3 + fbm(x * 0.02, z * 0.02, 3) * 1.4;
  const sw = smoothstep(52, 72, z) * (1 - smoothstep(175, 195, z));
  h = lerp(h, -0.3 + fbm(x * 0.06 + 3, z * 0.06, 3) * 0.95, sw);
  for (const [px, pz, r] of RIVER.pools) { const d = dist2d(x, z, px, pz); h = Math.min(h, lerp(-2.4, h, smoothstep(r - 3, r + 1.5, d))); }
  const dr = Math.abs(z - RIVER.riverZ(x));
  h = lerp(-4.6, h, smoothstep(12, 23, dr));
  h += smoothstep(-48, -120, z) * 34;
  h += smoothstep(150, 200, Math.abs(x - 40)) * 30;
  return h;
}

function fishJump(world, x, z, n = 6) {
  for (let i = 0; i < n; i++) {
    const f = mesh(G.cone(0.08, 0.35, 4), mat('#b9c2b0', { rough: 0.3, metal: 0.3 }), { parent: world.scene, pos: [x, 0, z], rot: [Math.PI / 2, 0, 0], cast: false });
    const a = rnd(0, TAU), sp = rnd(2, 4), vy = rnd(3, 5);
    let t = 0;
    const fn = world.onUpdate((dt) => {
      t += dt;
      f.position.set(x + Math.cos(a) * sp * t, world.waterY + vy * t - 4.9 * t * t, z + Math.sin(a) * sp * t);
      f.rotation.x += dt * 8;
      if (t > (vy / 4.9) + 0.05) { world.scene.remove(f); world.updaters.splice(world.updaters.indexOf(fn), 1); }
    });
  }
  Sound.noise(0.3, 2200, 'bandpass', 0.15, 0, 2);
}

CHAPTERS.river = {
  create() {
    seed(777);
    const world = new World({ bounds: { x: 40, z: 60, r: 150 } });
    applyTime(world, 'dusk');
    world.hemi.intensity = world.baseHemi = 1.05;
    makeTerrain(world, { size: 420, seg: 170, cx: 40, cz: 60, height: riverH, color: (x, z, y, s, c) => {
      const sw = smoothstep(52, 72, z) * (1 - smoothstep(175, 195, z));
      if (y < -0.2) c.set('#3a3a2c');
      else c.set('#4a5a2e').lerp(_tmpC.set('#3a4526'), fbm(x * 0.08, z * 0.08, 2) * 0.5 + 0.5);
      if (sw > 0.5) c.lerp(_tmpC.set('#4b4a34'), 0.5);
      if (y < 0.6 && y > -0.2) c.lerp(_tmpC.set('#6b5f45'), 0.6);
      if (s > 0.35) c.lerp(_tmpC.set('#62625a'), 0.6);
    } });
    makeWater(world, { y: 0, size: 900, x: 40, z: 60, color: '#4f6b58', opacity: 0.86 });
    const ripples = new Ripples(world, 36);
    world.maxDepth = 1.05;
    world.snapY = false;
    // swamp dressing
    const H = riverH;
    const swamp = (x, z) => z > 60 && z < 180;
    scatterInstanced(world, deadTreeGeo(), vegMat(0.003), scatter(QUALITY ? 90 : 55, () => { const x = rnd(-80, 140), z = rnd(62, 185); return { x, y: H(x, z) - 0.3, z, s: rnd(0.9, 1.6), ry: rnd(0, TAU), tilt: rnd(-0.15, 0.15) }; }), { cast: true });
    scatterInstanced(world, treeFernGeo(), vegMat(0.01), scatter(QUALITY ? 110 : 60, () => { const x = rnd(-80, 160), z = rnd(-40, 185); const h = H(x, z); if (h < 0.4) return null; return { x, y: h, z, s: rnd(1, 1.6), ry: rnd(0, TAU) }; }), { cast: false });
    scatterInstanced(world, coniferGeo(), vegMat(0.0025), scatter(QUALITY ? 260 : 140, () => { const x = rnd(-120, 200), z = rnd(-130, 40); const h = H(x, z); if (h < 1.5 || Math.abs(z - RIVER.riverZ(x)) < 24) return null; return { x, y: h, z, s: rnd(1.3, 2.4), ry: rnd(0, TAU) }; }), { cast: true });
    makeFerns(world, scatter(QUALITY ? 1800 : 900, () => { const x = rnd(-80, 160), z = rnd(-40, 190); const h = H(x, z); if (h < 0.15) return null; return { x, y: h - 0.05, z, s: rnd(0.8, 1.5), ry: rnd(0, TAU), tint: swamp(x, z) ? pick(['#6a7a40', '#7a8446']) : pick(['#5e8a3e', '#6f9a45']) }; }));
    const reeds = scatter(QUALITY ? 600 : 300, () => { const x = rnd(-80, 160), z = rnd(-12, 190); const h = H(x, z); if (h > 0.2 || h < -0.8) return null; return { x, y: h, z, s: rnd(0.8, 1.4), ry: rnd(0, TAU), tint: '#8a8a52' }; });
    makeFerns(world, reeds, { color: '#c8c080' });
    makeMotes(world, { color: '#e8e0b0', count: QUALITY ? 300 : 150 });
    // geothermal pipes in the swamp (hint that the island is engineered)
    for (let i = 0; i < 5; i++) mesh(G.cyl(0.35, 0.35, 14, 10), mat('#5b5246', { metal: 0.4 }), { parent: world.scene, pos: [-30 + i * 22, -0.05, 130 - i * 6], rot: [0, 0, Math.PI / 2], cast: false });
    // pier, boat, station, dam
    const pierParts = [];
    for (let z = RIVER.pier.z0; z > RIVER.pier.z1; z -= 1.5) {
      const plank = mesh(G.box(3, 0.15, 1.4), mat('#5d4a34'), { parent: world.scene, pos: [RIVER.pier.x, 0.8, z], receive: true });
      const post = mesh(G.cyl(0.12, 0.12, 5, 6), mat('#3f3223'), { parent: world.scene, pos: [RIVER.pier.x + 1.4, -1.6, z], cast: false });
      pierParts.push({ plank, post, z });
    }
    const boat = new THREE.Group();
    mesh(G.box(1.8, 0.6, 4.2), mat('#6a6a5a'), { parent: boat, pos: [0, 0.2, 0] });
    mesh(G.box(0.4, 0.5, 0.5), mat('#222'), { parent: boat, pos: [0, 0.6, -1.9] });
    boat.position.set(RIVER.pier.x - 2.6, 0.05, -9); world.add(boat);
    const crossbowCase = mesh(G.box(0.9, 0.3, 0.5), mat('#3f4a3a', { metal: 0.2 }), { parent: world.scene, pos: [RIVER.pier.x, 1.03, -10.5] });
    const st = new THREE.Group();
    for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) mesh(G.cyl(0.15, 0.15, 3, 6), mat('#3f3223'), { parent: st, pos: [a, 1.5, b] });
    mesh(G.box(5, 2.6, 5), mat('#6c6a58'), { parent: st, pos: [0, 4.2, 0] });
    mesh(G.box(5.6, 0.2, 5.6), mat('#3b3a30'), { parent: st, pos: [0, 5.6, 0] });
    const stTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#c9c1a6'; g.fillRect(0, 0, w, h); g.fillStyle = '#26221a'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.fillText('R-3 · S-3', w / 2, 44); });
    mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshLambertMaterial({ map: stTex }), { parent: st, pos: [0, 4.6, 2.52], cast: false });
    st.position.set(RIVER.station[0], H(...RIVER.station), RIVER.station[1]); world.add(st);
    world.circles.push({ x: RIVER.station[0], z: RIVER.station[1], r: 3 });
    const D = RIVER.dam;
    mesh(G.box(D.x1 - D.x0, 7, D.z1 - D.z0), mat('#7a7a70', { rough: 0.95 }), { parent: world.scene, pos: [(D.x0 + D.x1) / 2, -1.1, (D.z0 + D.z1) / 2], receive: true });
    mesh(G.box(D.x1 - D.x0 + 0.1, 2.0, D.gz1 - D.gz0), mat('#566b62', { rough: 0.3 }), { parent: world.scene, pos: [(D.x0 + D.x1) / 2, 1.5, (D.gz0 + D.gz1) / 2], cast: false });
    for (const z of [D.z1 - 0.2, D.gz1 + 0.2]) mesh(G.box(D.x1 - D.x0, 1, 0.12), mat('#4a4a44', { metal: 0.4 }), { parent: world.scene, pos: [(D.x0 + D.x1) / 2, 2.9, z], cast: false });
    const foamTex = canvasTex(128, 256, (g, w, h) => { for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${rnd(0.2, 0.8)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(3, 10), rnd(10, 40)); } });
    foamTex.wrapT = THREE.RepeatWrapping; foamTex.wrapS = THREE.RepeatWrapping;
    const fall = mesh(new THREE.PlaneGeometry(D.gz1 - D.gz0, 3), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.85, depthWrite: false }), { parent: world.scene, pos: [D.x1 + 0.3, 0.9, (D.gz0 + D.gz1) / 2], rot: [0, Math.PI / 2, 0], cast: false });
    const rapTex = canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${rnd(0.1, 0.45)})`; g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(6, 26), rnd(2, 5), 0, 0, TAU); g.fill(); } });
    rapTex.wrapS = rapTex.wrapT = THREE.RepeatWrapping; rapTex.repeat.set(4, 2);
    const rapids = mesh(new THREE.PlaneGeometry(50, 26), new THREE.MeshBasicMaterial({ map: rapTex, transparent: true, opacity: 0.7, depthWrite: false }), { parent: world.scene, pos: [117, 0.05, -16], rot: [-Math.PI / 2, 0, 0], cast: false });
    for (let i = 0; i < 9; i++) { const x = rnd(98, 135), z = rnd(-28, -6); const r = mesh(rockGeo(i + 50), new THREE.MeshLambertMaterial({ color: '#6c6a60', flatShading: true }), { parent: world.scene, pos: [x, -0.3, z], scale: [rnd(0.8, 1.6), 0.9, rnd(0.8, 1.6)] }); }
    const shelf = mesh(G.box(5, 0.4, 3), mat('#6a675c'), { parent: world.scene, pos: [RIVER.shelf[0], 0.25, RIVER.shelf[1]], receive: true });
    world.onUpdate((dt) => { foamTex.offset.y -= dt * 1.6; rapTex.offset.x -= dt * 0.35; });
    // floor: pier & dam walkways
    let pierBroken = false;
    world.floor = (x, z) => {
      if (Math.abs(x - RIVER.pier.x) < 1.5 && z < RIVER.pier.z0 + 0.7 && z > (pierBroken ? -5 : RIVER.pier.z1)) return 0.88;
      if (x > D.x0 && x < D.x1 && z > D.z0 && z < D.z1 + 1.2) return 2.4;
      if (Math.abs(x - RIVER.shelf[0]) < 2.5 && Math.abs(z - RIVER.shelf[1]) < 1.5) return 0.45;
      return H(x, z);
    };
    world.blocked = (x, z) => x > D.x0 - 0.2 && x < D.x1 + 0.2 && z > D.gz0 - 0.4 && z < D.gz1 + 0.4;
    // fish bones near the pier
    for (let i = 0; i < 6; i++) mesh(G.cone(0.05, 0.6, 4), mat('#d8d0bb'), { parent: world.scene, pos: [23 + rnd(-1, 1), H(23, 5) + 0.05, 5 + rnd(-1, 1)], rot: [Math.PI / 2, rnd(0, TAU), 0], cast: false });

    // ---------- Deinosuchus ----------
    const crocs = RIVER.pools.slice(0, 2).map(([px, pz, r]) => {
      const g = makeCroc(); world.add(g);
      const wake = makeWake(world);
      return { g, wake, px, pz, r, pos: new THREE.Vector2(px, pz), target: new THREE.Vector2(px, pz), yaw: 0, lunge: 0, cool: 0 };
    });
    // ---------- Spinosaurus: Charon ----------
    const spino = makeSpino(); world.add(spino);
    const SP = { x: 0, z: -22, y: -7.8, yaw: Math.PI / 2, state: 'lurk', t: 0, rise: 0, charge: 0, cool: 4, fishT: 6, lastRipple: 0 };
    const spinoHead = new THREE.Vector3();

    const S = { stage: 'swamp', darts: 0, dart: null, station: false, bones: false, crossbow: false, falseWaves: 0, cp: 'start', reveal: false, riverSeen: false };
    Game.state.flags.darts = 0;

    const nearWater = (x, z) => Math.abs(z - RIVER.riverZ(x)) < 20.5;
    const ctx = {
      world,
      spawn: { x: 0, z: 176, yaw: Math.PI },
      markers() {
        const m = [];
        if (S.stage === 'swamp') m.push({ x: 30, z: 40, label: 'река' });
        else if (S.stage === 'river' && !S.station) m.push({ x: RIVER.station[0], z: RIVER.station[1], label: 'R-3' });
        else if (S.stage === 'river') m.push({ x: RIVER.pier.x, z: -10, label: 'причал' });
        else if (S.stage === 'chase' || S.stage === 'swim') m.push({ x: 90, z: 3, label: 'плотина', cls: 'bad' });
        else if (S.stage === 'dam') m.push({ x: 86, z: -20, label: 'водосброс', cls: 'bad' });
        else if (S.stage === 'dart' && S.dart) m.push({ x: S.dart.pos.x, z: S.dart.pos.z, label: 'дротик' });
        return m;
      },
      subjects() {
        const out = [{ sp: 'spi', obj: spino, size: 12, lift: SP.y + 6, tag: SP.state === 'fish' && SP.rise > 0.6 ? 'Рыбалка у водосброса' : '', item: SP.state === 'fish' && SP.rise > 0.6 ? 'b_fish' : null, special: SP.rise > 0.6, maxDist: 120 }];
        return SP.rise > 0.3 ? out : [];
      },
      onThrow() {
        if (!S.crossbow) { HUD.toast('Приманок здесь нет. Арбалет D-04 — на причале у станции R-3.'); return; }
        Photo.toggle('aim');
      },
      onShoot() {
        if (S.darts <= 0) { HUD.toast('Дротики закончились — запас в станции R-3'); return; }
        S.darts--; Game.state.flags.darts = S.darts;
        HUD.viewfinder('aim', 'БИОПСИЙНЫЙ АРБАЛЕТ · дротиков: ' + S.darts);
        Sound.sfx('bolt');
        // hit test: the ray must pass close to the sail base or the flank
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        let best = 1e9, tgt = new THREE.Vector3(), dist = 0;
        for (const [lx, ly, lz] of [[0, 4.3, 0.5], [0, 5.5, -0.5], [0, 3.2, 1.5], [0, 3.4, -1.5]]) {
          const q = spino.localToWorld(new THREE.Vector3(lx, ly, lz));
          const to = q.clone().sub(camera.position);
          if (to.dot(dir) <= 0) continue;
          const off = to.clone().sub(dir.clone().multiplyScalar(to.dot(dir))).length();
          if (off < best) { best = off; tgt = q; dist = to.length(); }
        }
        window.__lastShot = { off: best, dist, rise: SP.rise };
        const hit = SP.rise > 0.5 && dist < 45 && best < 2.6;
        if (hit) {
          Sound.sfx('thud', 0.6); Sound.sfx('roar', 0.7);
          HUD.toast('ПОПАДАНИЕ · дротик взял пробу и отскочил в воду', 3);
          Photo.toggle('aim');
          startDart(tgt.x, tgt.z);
        } else {
          HUD.toast(SP.rise < 0.55 ? 'Мимо — он под водой. Ждите, когда поднимется.' : 'Мимо. Цельтесь в основание паруса.', 2.5);
          if (S.darts <= 0) setTimeout(() => HUD.toast('Дротиков нет. Ещё два — в станции R-3.', 3), 1500);
        }
      },
      async start() {
        Sound.bed('wind', 0.04); Sound.bed('insects', 0.04); Sound.bed('water', 0.04);
        HUD.objective('Пройдите болото', 'Держитесь мелководья. Глубокие омуты — дейнозухи: V-образный след на воде значит «не подходи».');
        HUD.say([{ who: 'Лена (рация)', text: 'Туман густой. Смотрите на воду, Итан. Круги — рыба. Клин — не рыба.' }]);
      },
      update(dt) {
        const P = Game.player, pp = P.pos;
        // fog: swamp thick, river clear
        const f = world.scene.fog, swampK = smoothstep(55, 85, pp.z);
        f.near = lerp(55, 6, swampK); f.far = lerp(460, 70, swampK);
        f.color.set(swampK > 0.5 ? '#77806e' : '#b39a86');
        Sound.bed('water', S.stage === 'dam' || S.stage === 'dart' ? 0.16 : 0.05);
        // ambient fish ripples & false waves in the swamp
        if (Math.random() < dt * 1.6) { const a = rnd(0, TAU), r = rnd(6, 22); const x = pp.x + Math.cos(a) * r, z = pp.z + Math.sin(a) * r; if (riverH(x, z) < -0.1) ripples.spawn(x, z, rnd(0.6, 1.2), 1.4, 0.4); }
        if (S.stage === 'swamp' && P.inWater > 0.1 && Math.random() < dt * 0.06 && S.falseWaves < 4) {
          S.falseWaves++;
          const a = Cam.yaw + rnd(-0.8, 0.8); const x = pp.x - Math.sin(a) * 9, z = pp.z - Math.cos(a) * 9;
          for (let i = 0; i < 4; i++) setTimeout(() => ripples.spawn(x, z, 4 + i, 2.2, 0.5), i * 250);
          Sound.sfx('splash', 0.35); Sound.bed('insects', 0, 0.5); setTimeout(() => Sound.bed('insects', 0.04, 2), 4000);
          if (S.falseWaves === 1) HUD.say([{ who: 'Лена (рация)', text: '…Итан? Что это было?' }, { who: 'Итан', text: 'Ничего. Волна. Просто волна.' }]);
        }
        // crocs
        for (const c of crocs) {
          c.cool -= dt;
          const dP = dist2d(pp.x, pp.z, c.pos.x, c.pos.y);
          let sp = 1.1;
          if (c.lunge > 0) { c.lunge -= dt; c.target.set(pp.x, pp.z); sp = 6; if (dP < 2.2) { c.lunge = 0; c.cool = 5; Sound.sfx('splash', 1); const left = P.hurt(1, new THREE.Vector3(c.pos.x, 0, c.pos.y)); if (left <= 0) Game.fail('Дейнозух', 'Клин на воде — это не рыба', () => ctx.restore()); } }
          else if (dP < 6 && P.inWater > 0.1 && c.cool <= 0) { c.lunge = 0.9; Sound.sfx('splash', 0.8); }
          else if (dist2d(c.pos.x, c.pos.y, c.target.x, c.target.y) < 1 || Math.random() < dt * 0.1) { const a = rnd(0, TAU), r = rnd(0, c.r - 2.5); c.target.set(c.px + Math.cos(a) * r, c.pz + Math.sin(a) * r); }
          const dx = c.target.x - c.pos.x, dz = c.target.y - c.pos.y, dd = Math.hypot(dx, dz);
          if (dd > 0.2) { c.pos.x += (dx / dd) * Math.min(sp, dd * 2) * dt; c.pos.y += (dz / dd) * Math.min(sp, dd * 2) * dt; c.yaw = dampAngle(c.yaw, Math.atan2(dx, dz), 3, dt); }
          c.g.position.set(c.pos.x, world.waterY - (c.lunge > 0 ? 0.05 : 0.2), c.pos.y); c.g.rotation.y = c.yaw;
          c.wake.position.set(c.pos.x, world.waterY + 0.02, c.pos.y); c.wake.rotation.y = c.yaw; c.wake.userData.mat.opacity = dd > 0.3 ? 0.5 : 0.1;
        }
        // stage transitions
        if (S.stage === 'swamp' && pp.z < 50) {
          S.stage = 'river'; S.cp = 'river';
          HUD.objective('Найдите речную станцию R-3', 'Станция на сваях у южного берега. Экспедиция D-04 оставила там снаряжение.');
          HUD.say([{ who: 'Лена', text: 'Великая река… Посмотрите на воду у берега — рыбьи кости. Здесь кто-то очень хорошо ест.' }]);
        }
        if (!S.riverSeen && S.stage !== 'swamp' && pp.z < 20) { S.riverSeen = true; }
        // Charon
        updateSpino(dt, P);
        if (S.stage === 'swim' && P.inWater < 0.9) { S.stage = 'chase'; world.allowDeep = false; world.speedMul = 1; HUD.objective('Уходите от воды! Бегите к плотине', 'Вдоль южного берега на восток. Харон не выходит далеко на сушу — держитесь дальше шести метров от воды.'); }
        if (S.stage === 'chase' && pp.x > D.x0 - 1 && P.pos.y > 2) {
          S.stage = 'dam'; S.cp = 'dam'; SP.state = 'fish'; SP.fishT = 5; SP.rise = 0;
          HUD.objective('Выстрелите биопсийным дротиком', IS_TOUCH ? 'Харон поднимается у водосброса за рыбой. Кнопка «Арбалет», цельтесь в основание паруса.' : 'Харон поднимается у водосброса за рыбой. Q — арбалет, цельтесь в основание паруса, клик — выстрел.');
          HUD.say([{ who: 'Лена (рация)', text: '«Никогда не стой на плотине, когда вода уходит»… Мама… Мара это писала. Итан, когда вода отступит — он поднимется. Три секунды.' }]);
          $('tbThrow').textContent = 'Арбалет';
        }
        if (S.dart) updateDart(dt, P);
      },
      restore() {
        const at = { start: [0, 176, Math.PI], river: [30, 40, Math.PI], chase: [30, 8, -Math.PI / 2], dam: [90, 2, Math.PI], dart: [90, 2, Math.PI] }[S.cp] || [0, 176, Math.PI];
        Game.player.place(at[0], at[1], at[2]);
        world.allowDeep = false; world.speedMul = 1;
        if (S.stage === 'swim') S.stage = 'chase';
        if (S.cp === 'dart' && S.dart) { S.dart.mesh.parent && world.scene.remove(S.dart.mesh); S.dart = null; S.stage = 'dam'; HUD.timer(null); if (S.darts < 1) S.darts = 1; }
        SP.charge = 0; SP.cool = 4; crocs.forEach((c) => { c.lunge = 0; c.cool = 4; });
      },
      dispose() { HUD.throwBtn(false); $('tbThrow').textContent = 'Приманка'; HUD.timer(null); world.speedMul = 1; },
    };

    function updateSpino(dt, P) {
      const pp = P.pos;
      SP.cool -= dt;
      let targetRise = 0, tx = SP.x, tz = SP.z, speed = 3;
      const rz = RIVER.riverZ(SP.x);
      if (SP.state === 'lurk') {
        tx = clamp(pp.x + 6, -40, D.x0 - 8); tz = rz + Math.sin(Game.time * 0.2) * 4;
        speed = 4;
        if ((S.stage === 'chase' || S.stage === 'swim') && SP.cool <= 0 && Math.abs(pp.x - SP.x) < 16) {
          const dw = Math.abs(pp.z - RIVER.riverZ(pp.x)) - 20;
          if (dw < 5.5 || S.stage === 'swim') { SP.state = 'charge'; SP.t = 0; fishJump(world, SP.x, rz + 8, 7); for (let i = 0; i < 3; i++) ripples.spawn(SP.x + rnd(-3, 3), rz + 10, 5 + i * 2, 2, 0.6); }
        }
      } else if (SP.state === 'charge') {
        SP.t += dt; tx = pp.x; tz = clamp(pp.z, rz - 16, rz + 17.5); speed = 7; targetRise = SP.t > 0.9 ? 1 : 0.4;
        spino.localToWorld(spinoHead.set(0, 4.6, 7.5));
        if (SP.t > 1 && dist2d(spinoHead.x, spinoHead.z, pp.x, pp.z) < 4.2) {
          Sound.sfx('roar', 1); Sound.sfx('splash', 1); Cam.shake = 0.6;
          const left = P.hurt(1, spinoHead.clone());
          SP.state = 'lurk'; SP.cool = 5;
          if (left <= 0) Game.fail('Харон', 'Держитесь дальше шести метров от воды', () => ctx.restore());
        }
        if (SP.t > 3.2) { SP.state = 'lurk'; SP.cool = 3.5; }
      } else if (SP.state === 'fish') {
        tx = 84; tz = -20;
        const far = dist2d(SP.x, SP.z, 84, -20);
        speed = far > 4 ? 7 : 2;
        if (far < 4) SP.fishT -= dt;
        if (SP.fishT < 1.2 && SP.fishT > 1.1) { fishJump(world, 86, -20, 8); for (let i = 0; i < 3; i++) ripples.spawn(85 + rnd(-2, 2), -20 + rnd(-2, 2), 4 + i * 2, 2, 0.6); Sound.sfx('splash', 0.7); }
        if (SP.fishT < 0) targetRise = 1;
        if (SP.fishT < -4.2) { SP.fishT = rnd(8, 12); }
        if (SP.rise > 0.6 && dist2d(pp.x, pp.z, SP.x, SP.z) < 45) Journal.add('spi', 'b_fish');
      } else if (SP.state === 'reveal') {
        targetRise = 1; speed = 0;
      }
      if (SP.state !== 'reveal') {
        const dx = tx - SP.x, dz = tz - SP.z, dd = Math.hypot(dx, dz);
        if (dd > 0.3) { SP.x += (dx / dd) * Math.min(speed, dd) * dt; SP.z += (dz / dd) * Math.min(speed, dd) * dt; SP.yaw = dampAngle(SP.yaw, Math.atan2(dx, dz), 2, dt); }
      }
      SP.rise = damp(SP.rise, targetRise, targetRise > SP.rise ? 3 : 1.6, dt);
      SP.y = lerp(-7.8, -1.3, SP.rise);
      spino.position.set(SP.x, SP.y, SP.z);
      spino.rotation.y = SP.yaw;
      spino.userData.anim(dt, SP.rise < 0.5 ? 2 : 0.5, { open: SP.rise > 0.7 && (SP.state === 'charge' || SP.state === 'reveal'), up: SP.state === 'fish' && SP.rise > 0.7, lunge: SP.state === 'charge' && SP.rise > 0.8 });
      if (Game.time - SP.lastRipple > 0.35) { SP.lastRipple = Game.time; ripples.spawn(SP.x, SP.z, SP.rise > 0.5 ? 5 : 2.2, 1.8, 0.45); }
    }
    function startDart(x, z) {
      const g = new THREE.Group();
      mesh(G.cyl(0.03, 0.03, 0.5, 5), mat('#ddd'), { parent: g, rot: [0, 0, Math.PI / 2] });
      mesh(G.sphere(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff7a1a' }), { parent: g, pos: [0, 0.08, 0] });
      const beacon = new THREE.PointLight('#ff7a1a', 4, 8, 2); beacon.position.y = 0.4; g.add(beacon);
      world.add(g);
      const pts = [V(x, 0, z), V(D.x1 + 3, 0, -20), V(104, 0, -10), V(RIVER.shelf[0], 0, RIVER.shelf[1] - 1.2), V(122, 0, -9), V(136, 0, -12)];
      S.dart = { mesh: g, curve: new THREE.CatmullRomCurve3(pts), t: 0, pos: new THREE.Vector3(x, 0, z), got: false };
      S.stage = 'dart'; S.cp = 'dart';
      HUD.objective('Выловите дротик на порогах', 'Оранжевый поплавок. Спуститесь с плотины на восток — к каменной полке у южного берега.');
      HUD.say([{ who: 'Лена (рация)', text: 'Попали! Дротик в воде — течение несёт его к порогам. Бегом, Итан, внизу есть каменная полка!' }], true);
      SP.state = 'lurk'; SP.cool = 30;
    }
    function updateDart(dt, P) {
      const d = S.dart;
      d.t += dt / 26;
      const p = d.curve.getPointAt(clamp(d.t, 0, 1));
      d.pos.copy(p);
      d.mesh.position.set(p.x, world.waterY + 0.05 + Math.sin(Game.time * 4) * 0.04, p.z);
      d.mesh.rotation.y += dt;
      if (Math.random() < dt * 3) ripples.spawn(p.x, p.z, 0.8, 1, 0.5);
      HUD.timer(`ДРОТИК УПЛЫВАЕТ · ${Math.max(0, Math.ceil((1 - d.t) * 26))} с`);
      const near = dist2d(P.pos.x, P.pos.z, p.x, p.z) < 3.6;
      if (near && !d.got) {
        HUD.prompt('Выловить дротик', 'E');
        if (Input.pressed('interact')) {
          d.got = true; world.scene.remove(d.mesh); S.dart = null; HUD.timer(null);
          (async () => {
            const ok = await DNA.collect('spi', true, 'SPINOSAURUS');
            if (!ok) return;
            Journal.add('spi', 'dna');
            S.stage = 'done';
            await HUD.say([{ who: 'Лена', text: 'Три. Три из пяти, Итан.' }, { who: 'Хальм (рация)', text: 'Возвращайтесь в лагерь. Скоро стемнеет, и идёт шторм.' }]);
            await wait(0.8);
            Game.complete('attack', { noCard: true });
          })();
        }
      }
      if (d.t >= 1 && !d.got) {
        world.scene.remove(d.mesh); S.dart = null; HUD.timer(null);
        S.stage = 'dam'; SP.state = 'fish'; SP.fishT = 6;
        if (S.darts <= 0) S.darts = 1;
        HUD.toast(`Дротик унесло течением. Дротиков: ${S.darts}`, 3.5);
        HUD.objective('Выстрелите ещё раз', 'Вернитесь на плотину. Харон снова поднимется у водосброса.');
      }
    }

    // interactions
    world.interact({ x: RIVER.station[0], z: RIVER.station[1] + 3.5, r: 3, hold: 1, label: 'Обыскать станцию R-3', enabled: () => !S.station && S.stage !== 'swamp',
      onUse: () => {
        S.station = true; S.darts += 2;
        HUD.say([{ who: '[Дневник D-04 · Мара Линд]', text: '«Запись одиннадцать. Харон ловит у порогов. Никогда не стой на плотине, когда вода уходит. Биопсийный арбалет оставляю на причале — пусть будет у того, кто придёт после нас».', dur: 8 }, { who: 'Лена', text: '<em>(тихо)</em> …Пусть будет у того, кто придёт после нас.' }]);
        HUD.objective('Заберите арбалет на причале', 'Причал у станции, на самом конце — ящик D-04.');
        HUD.toast('Дротиков: ' + S.darts);
      } });
    world.interact({ x: 23, z: 5, r: 2.4, label: 'Изучить кости', enabled: () => !S.bones, onUse: () => { S.bones = true; Journal.add('spi', 't_bones'); HUD.say([{ who: '[Сканер]', text: 'РЫБЬИ КОСТИ · крупная рыба, 1–2 м · следы зубов: конические, без зазубрин — не крокодил', dur: 5 }]); } });
    world.interact({ x: RIVER.pier.x, z: -9.8, r: 2.2, hold: 0.8, label: 'Взять биопсийный арбалет D-04', enabled: () => S.station && !S.crossbow,
      onUse: async () => {
        S.crossbow = true; S.darts = Math.max(S.darts, 2); Game.state.flags.darts = S.darts; crossbowCase.visible = false;
        HUD.throwBtn(true); $('tbThrow').textContent = 'Арбалет';
        // reveal
        SP.x = RIVER.pier.x - 10; SP.z = -14; SP.yaw = Math.PI / 2; SP.state = 'reveal'; SP.rise = 0;
        Sound.silenceAll(0.3);
        fishJump(world, RIVER.pier.x - 6, -12, 10);
        for (let i = 0; i < 5; i++) setTimeout(() => ripples.spawn(RIVER.pier.x - 8, -14, 3 + i * 2, 2.4, 0.6), i * 200);
        const P = Game.player;
        await Cine.play([
          { from: V(RIVER.pier.x + 3, 2.4, -3), look: V(RIVER.pier.x - 6, 0, -13), dur: 1.8, cut: true, fov: 50, onStart: () => HUD.say([{ who: 'Лена (рация)', text: '<em>(шёпотом)</em> Вода уходит…', dur: 1.6 }]) },
          { from: V(RIVER.pier.x + 12, 1.0, 2), to: V(RIVER.pier.x + 11, 1.2, 0), look: () => V(SP.x, SP.y + 6.5, SP.z), dur: 3.4, cut: true, fov: 48, onStart: () => { Sound.sfx('splash', 1); Sound.sfx('roar', 0.8); Journal.add('spi', 'seen'); } },
          { from: V(RIVER.pier.x + 3, 0.5, -6), look: () => spino.localToWorld(new THREE.Vector3(0, 5, 6)), dur: 3, cut: true, fov: 58, onStart: () => { Cam.shake = 0.4; HUD.say([{ who: 'Лена (рация)', text: 'Харон. Мама… Мара Линд называла его Хароном.', dur: 3 }]); } },
          { from: V(RIVER.pier.x + 14, 6, 4), look: V(RIVER.pier.x - 2, 1, -10), dur: 1.8, cut: true, fov: 52,
            onStart: () => { Sound.sfx('roar', 1); Sound.sfx('crack', 1); Sound.sfx('splash', 1); Cam.shake = 0.8; pierBroken = true; pierParts.forEach((p) => { if (p.z < -5) { p.plank.visible = false; p.post.visible = false; } }); boat.rotation.z = 2.4; boat.position.y = -0.3; } },
        ], { skippable: true });
        SP.state = 'lurk'; SP.cool = 6; SP.rise = 0.6;
        P.place(RIVER.pier.x - 1, -8.5, 0);
        world.allowDeep = true; world.speedMul = 0.9;
        S.stage = 'swim'; S.cp = 'chase';
        Sound.bed('wind', 0.04); Sound.bed('water', 0.06);
        HUD.objective('Плывите к берегу!', 'На юг, к мелководью. Не останавливайтесь.');
        HUD.say([{ who: 'Лена (рация)', text: 'Итан! ИТАН! К берегу, быстро!' }], true);
      } });
    return ctx;
  },
};

// ---------- interlude: the night raptors came to camp ----------
CHAPTERS.attack = {
  create() {
    const { world } = buildValleyWorld({ time: 'night' });
    makeRain(world);
    world.scene.fog.near = 8; world.scene.fog.far = 90;
    const cx = VALLEY.camp.x, cz = VALLEY.camp.z;
    const fire = new THREE.PointLight('#ff9a4a', 12, 18, 1.6); fire.position.set(cx, world.groundH(cx, cz) + 1, cz + 3); world.add(fire);
    const flood = new THREE.SpotLight('#dfe6ff', 40, 50, 0.6, 0.4, 1.2); flood.position.set(cx + 8, world.groundH(cx, cz) + 6, cz + 10); flood.target.position.set(cx - 4, 0, cz - 8); world.add(flood); world.add(flood.target);
    const diego = makeNPC('diego'); diego.userData.scripted = true; diego.position.set(cx - 4, world.groundH(cx - 4, cz), cz - 2); world.add(diego);
    const lena = makeNPC('lena'); lena.position.set(cx + 2, world.groundH(cx + 2, cz + 4), cz + 4); lena.rotation.y = Math.PI; world.add(lena);
    const lucas = makeNPC('lucas'); lucas.position.set(cx + 4, world.groundH(cx + 4, cz + 2), cz + 2); lucas.rotation.y = -2.2; world.add(lucas);
    const raps = [0, 1, 2].map((i) => { const r = makeRaptor({ notch: i === 0, skin: '#3f3f34' }); r.position.set(cx - 18 - i * 3, world.groundH(cx - 18, cz - 10), cz - 10 + i * 5); world.add(r); return r; });
    let t = 0;
    const path = [V(cx - 4, 0, cz - 2), V(cx - 12, 0, cz - 20), V(cx - 20, 0, cz - 46)];
    const dPath = new THREE.CatmullRomCurve3(path);
    world.onUpdate((dt) => {
      t += dt;
      fire.intensity = 10 + Math.sin(Game.time * 13) * 2 + Math.sin(Game.time * 7) * 1.5;
      const run = clamp((t - 14) / 7, 0, 1);
      const dp = dPath.getPointAt(run);
      diego.position.set(dp.x, world.groundH(dp.x, dp.z), dp.z);
      diego.rotation.y = run > 0 ? Math.atan2(-8, -18) : 0.8;
      diego.userData.anim(dt, run > 0 && run < 1 ? 6 : 0, {});
      raps.forEach((r, i) => {
        let x, z, sp;
        if (t < 14) { const a = Game.time * 0.35 + i * 2.1; x = cx + Math.cos(a) * (14 + i * 2); z = cz + Math.sin(a) * (12 + i * 2); sp = 3; }
        else { const q = dPath.getPointAt(clamp(run - 0.12 - i * 0.05, 0, 1)); x = q.x + i; z = q.z + 3 + i * 2; sp = 7; }
        const dx = x - r.position.x, dz = z - r.position.z;
        r.position.x = damp(r.position.x, x, 3, dt); r.position.z = damp(r.position.z, z, 3, dt);
        r.position.y = world.groundH(r.position.x, r.position.z);
        if (Math.hypot(dx, dz) > 0.05) r.rotation.y = Math.atan2(dx, dz);
        r.userData.anim(dt, sp, { alert: true, open: t > 14 });
      });
    });
    const ctx = {
      world, allowPhoto: false,
      spawn: { x: cx + 2, z: cz + 6, yaw: Math.PI },
      async start() {
        HUD.show(false);
        Game.player.model.visible = false;
        Sound.bed('rain', 0.16); Sound.bed('wind', 0.08);
        const g = (x, z, y = 1.7) => V(x, world.groundH(x, z) + y, z);
        await Cine.play([
          { from: g(cx + 3, cz + 7, 1.2), to: g(cx + 3, cz + 6.5, 1.3), look: g(cx - 6, cz - 6, 1.2), dur: 4, cut: true, fov: 60, onStart: () => { HUD.say([{ who: '', text: '<em>Лагерь «Эхо». Ночь. Шторм.</em>', dur: 3 }]); } },
          { from: g(cx - 8, cz + 12, 2.5), look: g(cx - 16, cz - 6, 1), dur: 3.5, cut: true, fov: 55, onStart: () => { lightning(world, 1, 0.5); Sound.sfx('click', 0.8); } },
          { from: g(cx + 6, cz - 2, 1.8), look: g(cx - 2, cz + 2, 1.4), dur: 4, cut: true, fov: 55, onStart: () => HUD.say([{ who: 'Лена', text: 'Они пришли за нами. Они шли от комплекса всё это время.', dur: 3.6 }]) },
          { from: g(cx - 2, cz + 6, 1.6), look: g(cx - 4, cz - 2, 1.6), dur: 3, cut: true, fov: 50, onStart: () => { lightning(world, 0.8, 0.3); HUD.say([{ who: 'Диего', text: 'Эй! ЭЙ! Сюда, уроды! За мной!', dur: 2.6 }]); Sound.sfx('shot', 1); setTimeout(() => Sound.sfx('shot', 1), 400); } },
          { from: g(cx + 4, cz + 4, 3), look: () => diego.position.clone().add(V(0, 1, 0)), dur: 7, cut: true, fov: 50, onStart: () => { setTimeout(() => HUD.say([{ who: 'Итан', text: 'Диего!', dur: 1.6 }]), 1500); [1200, 2600, 4100, 5600].forEach((ms, i) => setTimeout(() => Sound.sfx('shot', 0.8 - i * 0.18), ms)); } },
          { from: g(cx + 2, cz + 5, 1.7), look: g(cx - 20, cz - 40, 2), dur: 5, cut: true, fov: 45, onStart: () => { setTimeout(() => HUD.say([{ who: 'Лукас', text: '<em>(тихо)</em> …Диего?', dur: 2.6 }]), 2200); } },
        ], { skippable: true });
        await HUD.fade(1, 1.2);
        Game.complete('peaks');
      },
      update() {},
    };
    return ctx;
  },
};
