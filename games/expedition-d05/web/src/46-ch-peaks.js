// ============================================================
// 46-ch-peaks.js — Chapter IV: mountain path & nests, DNA 4 — Pteranodon
// ============================================================
const PEAK = { R0: 150, R1: 29, turns: 1.12, a0: Math.PI * 0.5, halfW: 3.0, N: 260 };
function peakBase(x, z) {
  const r = Math.hypot(x, z);
  return 128 * Math.pow(clamp(1 - r / 178, 0, 1), 1.1) + fbm(x * 0.03, z * 0.03, 4) * 5 - 8;
}
function peakPath(t) {
  const a = PEAK.a0 + t * TAU * PEAK.turns, R = lerp(PEAK.R0, PEAK.R1, t);
  return { x: Math.cos(a) * R, z: Math.sin(a) * R, a, R, t };
}
const PEAK_PTS = (() => {
  const pts = [];
  for (let i = 0; i <= PEAK.N; i++) { const t = i / PEAK.N, p = peakPath(t); pts.push(p); }
  // heights follow the mountain, smoothed to be monotonic
  let y = -1e9;
  for (const p of pts) { const b = 128 * Math.pow(clamp(1 - p.R / 178, 0, 1), 1.1) - 6; y = Math.max(y + 0.05, b); p.y = y; }
  for (const p of pts) p.bridge = p.t > 0.535 && p.t < 0.575;
  return pts;
})();
const PEAK_TOP = PEAK_PTS[PEAK_PTS.length - 1].y;
function nearestPeak(x, z) {
  let best = null, bd = 1e9;
  for (const p of PEAK_PTS) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; } }
  return { p: best, d: Math.sqrt(bd) };
}
function peakHeight(x, z) {
  let h = peakBase(x, z);
  const r = Math.hypot(x, z);
  const { p, d } = nearestPeak(x, z);
  const inner = r < p.R;
  if (d < PEAK.halfW) h = p.bridge ? p.y - 26 : p.y + fbm(x * 0.3, z * 0.3, 1) * 0.12;
  else if (d < PEAK.halfW + 9) {
    const k = d - PEAK.halfW;
    if (inner) h = Math.max(h, p.y + k * 1.4);
    else h = Math.min(h, p.y - k * 2.4);
    if (p.bridge) h = Math.min(h, p.y - 26 + (inner ? k * 3 : 0));
  }
  h = lerp(PEAK_TOP, h, smoothstep(24, 31, r));
  return h;
}

CHAPTERS.peaks = {
  create() {
    seed(4040);
    const world = new World({ bounds: { x: 0, z: 0, r: 175 } });
    applyTime(world, 'day');
    world.scene.fog = new THREE.Fog('#d7e2ea', 70, 420);
    world.hemi.intensity = world.baseHemi = 1.2;
    makeTerrain(world, { size: 380, seg: 190, height: peakHeight, color: (x, z, y, s, c) => {
      c.set('#6f6e66').lerp(_tmpC.set('#57574f'), fbm(x * 0.07, z * 0.07, 2) * 0.5 + 0.5);
      if (s < 0.18 && y < 70) c.lerp(_tmpC.set('#5d6a44'), 0.55);
      if (y > PEAK_TOP - 3) c.lerp(_tmpC.set('#e6e3d8'), 0.45);
      const { d } = nearestPeak(x, z);
      if (d < PEAK.halfW) c.lerp(_tmpC.set('#8a8270'), 0.5);
    } });
    const H = (x, z) => world.terrain.sample(x, z);
    world.floor = (x, z) => {
      const { p, d } = nearestPeak(x, z);
      if (p.bridge && d < 1.6) return p.y + 0.15;
      return H(x, z);
    };
    world.maxSlope = 1.25;
    // bridge deck & ropes
    PEAK_PTS.filter((p) => p.bridge).forEach((p, i, arr) => {
      const n = arr[i + 1] || p;
      const len = Math.hypot(n.x - p.x, n.z - p.z) + 0.2;
      const deck = mesh(G.box(3.2, 0.14, Math.max(len, 1.2)), mat('#6b5638'), { parent: world.scene, pos: [p.x, p.y + 0.08, p.z], rot: [0, Math.atan2(n.x - p.x, n.z - p.z), 0], receive: true });
      for (const s of [-1, 1]) mesh(G.box(0.05, 0.05, Math.max(len, 1.2)), mat('#3a3024'), { parent: deck, pos: [s * 1.55, 1, 0], cast: false });
    });
    // clouds under the summit
    const cloudGeo = new THREE.SphereGeometry(1, 10, 7);
    const cloudM = new THREE.MeshLambertMaterial({ color: '#f4f6f8', transparent: true, opacity: 0.85, depthWrite: false });
    const clouds = scatterInstanced(world, cloudGeo, cloudM, scatter(46, () => { const a = rnd(0, TAU), r = rnd(120, 300); return { x: Math.cos(a) * r, y: rnd(24, 44), z: Math.sin(a) * r, s: rnd(10, 22), sx: rnd(1.4, 2.4), sy: 0.35 }; }), { cast: false, receive: false });
    makeVeil(world, { r: 520, h: 300 });
    // sparse alpine vegetation & rocks
    makeFerns(world, scatter(QUALITY ? 700 : 350, () => { const x = rnd(-170, 170), z = rnd(-170, 170); const h = peakHeight(x, z); const { d } = nearestPeak(x, z); if (h > 60 || d < PEAK.halfW + 0.5 || d > 30) return null; return { x, y: h - 0.05, z, s: rnd(0.5, 1), ry: rnd(0, TAU), tint: '#7a8a52' }; }));
    scatterInstanced(world, coniferGeo(), vegMat(0.003), scatter(QUALITY ? 220 : 120, () => { const x = rnd(-180, 180), z = rnd(-180, 180); const h = peakHeight(x, z); const { d } = nearestPeak(x, z); if (h > 45 || d < PEAK.halfW + 3) return null; return { x, y: h, z, s: rnd(1.2, 2), ry: rnd(0, TAU) }; }), { cast: true });
    const rockM = new THREE.MeshLambertMaterial({ color: '#7d7b72', flatShading: true });
    // D-02 wreck, relay mast
    const at = (t) => PEAK_PTS[Math.round(t * PEAK.N)];
    const wreckP = at(0.3), relayP = at(0.46);
    const off = (p, k) => ({ x: p.x + Math.cos(p.a) * k, z: p.z + Math.sin(p.a) * k });
    const wr = off(wreckP, 5.2);
    const wreck = makeHelicopter({ color: '#4a4a3a' });
    wreck.position.set(wr.x, wreckP.y - 1.2, wr.z); wreck.rotation.set(0.5, wreckP.a, 1.1); wreck.userData.rotor.rotation.set(0.4, 0.3, 0.2);
    world.add(wreck);
    const rl = off(relayP, -4.2);
    const mast = new THREE.Group();
    mesh(G.cyl(0.12, 0.2, 12, 6), mat('#6b6b66', { metal: 0.5 }), { parent: mast, pos: [0, 6, 0] });
    mesh(G.box(1.4, 1.4, 1), mat('#55594f'), { parent: mast, pos: [0, 0.7, 0] });
    const relayLed = mesh(G.sphere(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: '#441111' }), { parent: mast, pos: [0, 12.2, 0], cast: false });
    mast.position.set(rl.x, peakHeight(rl.x, rl.z), rl.z); world.add(mast);
    // summit: nests, sentinel pillars, chick ledge
    const nests = [[4, -6], [-9, 4], [12, 8], [-4, 15], [-15, -8], [16, -12], [0, 0]];
    nests.forEach(([x, z]) => { const n = mesh(new THREE.TorusGeometry(1.4, 0.35, 5, 12), mat('#6a5a3a'), { parent: world.scene, pos: [x, PEAK_TOP + 0.2, z], rot: [Math.PI / 2, 0, 0] }); });
    for (let i = 0; i < 4; i++) mesh(G.sphere(0.25, 8, 6), mat('#e9e2cc'), { parent: world.scene, pos: [4 + rnd(-0.5, 0.5), PEAK_TOP + 0.35, -6 + rnd(-0.5, 0.5)], scale: [1, 1.25, 1], cast: false });
    const sentinels = [[-12, -14, 0.6], [14, 2, 2.6], [-6, 20, 4.4]].map(([x, z, base], i) => {
      const pillar = mesh(G.cyl(1.4, 2.2, 7, 7), rockM, { parent: world.scene, pos: [x, PEAK_TOP + 3.5, z] });
      world.circles.push({ x, z, r: 2.3 });
      const b = makePtera({ scale: 1.2 }); b.position.set(x, PEAK_TOP + 7.2, z); world.add(b);
      return { g: b, x, z, base, look: base };
    });
    const endP = PEAK_PTS[PEAK_PTS.length - 1];
    const chickA = endP.a + Math.PI * 0.85;
    const chickPos = { x: Math.cos(chickA) * 25, z: Math.sin(chickA) * 25 };
    const chick = makePtera({ scale: 0.32, skin: '#b9a080', wing: '#9a8060', crest: '#c86a3a' }); chick.position.set(chickPos.x, PEAK_TOP, chickPos.z); world.add(chick);
    bloodDecal(world, chickPos.x + 0.3, chickPos.z, 0.4);
    // colony: perched + flying
    const perched = []; for (let i = 0; i < (QUALITY ? 14 : 9); i++) { const [nx, nz] = nests[i % nests.length]; const b = makePtera(); b.position.set(nx + rnd(-1.5, 1.5), PEAK_TOP + 0.4, nz + rnd(-1.5, 1.5)); b.rotation.y = rnd(0, TAU); world.add(b); perched.push(b); }
    const flyers = []; for (let i = 0; i < (QUALITY ? 22 : 12); i++) { const b = makePtera(); world.add(b); flyers.push({ g: b, a: rnd(0, TAU), r: rnd(28, 70), h: rnd(10, 34), sp: rnd(0.12, 0.22) * (rng() < 0.5 ? 1 : -1), dive: null }); }
    const shadowM = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, depthWrite: false });
    const diveShadow = mesh(new THREE.CircleGeometry(1.6, 20).rotateX(-Math.PI / 2), shadowM, { parent: world.scene, cast: false });
    makeMotes(world, { color: '#ffffff', count: QUALITY ? 260 : 130, speed: 3 });

    const S = { stage: 'climb', relay: false, eaves: false, wreck: false, seen: false, alarm: 0, swarm: 0, carrying: false, chickHome: false, dna: false, cp: 'start', gust: null, nextGust: 9, sentinelObs: 0, escapeFrom: null, diveT: 3 };
    world.wind.set(1, 0);
    const pathAt = (x, z) => nearestPeak(x, z);
    const outward = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };

    function fall() {
      Game.fail('Сорвались', 'Слышите вой ветра — присядьте и держитесь', () => ctx.restore());
    }
    const ctx = {
      world,
      spawn: { x: PEAK_PTS[2].x, z: PEAK_PTS[2].z, yaw: Math.atan2(PEAK_PTS[6].x - PEAK_PTS[2].x, PEAK_PTS[6].z - PEAK_PTS[2].z) },
      markers() {
        const m = [];
        if (S.stage === 'climb') { const t = !S.relay ? 0.46 : 1; const p = at(t); m.push({ x: p.x, z: p.z, label: !S.relay ? 'ретранслятор' : 'гнёзда' }); }
        else if (S.stage === 'summit' && !S.carrying && !S.chickHome) m.push({ x: chickPos.x, z: chickPos.z, label: 'птенец' });
        else if (S.carrying) m.push({ x: 4, z: -6, label: 'гнездо' });
        else if (S.stage === 'escape') { const p = at(0.63); m.push({ x: p.x, z: p.z, label: 'осыпь', cls: 'bad' }); }
        return m;
      },
      subjects() {
        const out = [];
        sentinels.forEach((s) => out.push({ sp: 'pte', obj: s.g, size: 5, lift: 0.5, tag: 'Часовой', item: 'b_sentinel', special: true }));
        flyers.slice(0, 8).forEach((f) => out.push({ sp: 'pte', obj: f.g, size: 5, lift: 0, maxDist: 90 }));
        if (S.chickHome) out.push({ sp: 'pte', obj: chick, size: 2, lift: 0.3, tag: 'Птенец в гнезде', item: 'b_care', special: true });
        return out;
      },
      async start() {
        Sound.bed('wind', 0.14);
        HUD.objective('Поднимитесь к ретранслятору', 'Тропа Варна вьётся вокруг горы. На открытых участках бывают порывы ветра.');
        HUD.say([{ who: 'Хальм (рация)', text: 'Ретранслятор — на полпути. Без связи мы здесь одни.' }, { who: 'Лена (рация)', text: 'Диего бы уже шутил про высоту…' }, { who: 'Хальм (рация)', text: 'Идите, доктор. Итан, мы за вами.' }]);
      },
      update(dt) {
        const P = Game.player, pp = P.pos;
        const { p: np, d: nd } = pathAt(pp.x, pp.z);
        // clouds drift, relay light
        clouds.rotation.y += dt * 0.004;
        relayLed.material.color.set(S.relay && (Game.time % 1.2) < 0.2 ? '#ff4040' : '#441111');
        // gusts on exposed stretches
        const exposed = (np.t > 0.2 && np.t < 0.42) || (np.t > 0.6 && np.t < 0.8);
        if (S.stage === 'climb' || S.stage === 'escape') {
          S.nextGust -= dt;
          if (!S.gust && exposed && S.nextGust <= 0) { S.gust = { t: 0 }; Sound.sfx('whistle', 1.2); Sound.bed('wind', 0.35, 0.8); HUD.toast(IS_TOUCH ? 'Порыв ветра — нажмите «Присесть»!' : 'Порыв ветра — присядьте (C)!', 2.2); }
          if (S.gust) {
            S.gust.t += dt;
            if (S.gust.t > 1.4 && S.gust.t < 3.4) {
              Cam.shake = Math.max(Cam.shake, 0.12);
              if (!P.crouch) {
                const o = outward(pp.x, pp.z);
                pp.x += o.x * 2.1 * dt; pp.z += o.z * 2.1 * dt;
                const gy = world.groundH(pp.x, pp.z);
                if (gy < np.y - 2.4) { S.gust = null; fall(); }
              }
            }
            if (S.gust && S.gust.t > 3.6) { S.gust = null; S.nextGust = rnd(6, 9); Sound.bed('wind', 0.14, 1.5); }
          }
        }
        // wreck & relay
        if (!S.wreck && dist2d(pp.x, pp.z, wr.x, wr.z) < 7) { S.wreck = true; S.cp = 'wreck'; }
        // arrival at the summit
        if (S.stage === 'climb' && Math.hypot(pp.x, pp.z) < 30 && pp.y > PEAK_TOP - 2) {
          S.stage = 'summit'; S.cp = 'summit';
          Journal.add('pte', 'seen');
          HUD.objective('Найдите способ взять образец', 'Колония. Часовые на каменных столбах поворачивают головы — не попадайтесь им на глаза. Присядьте.');
          HUD.say([{ who: 'Лена (рация)', text: 'Сотни… Итан, на столбах — часовые. Если они вас увидят, поднимется вся колония.' }, { who: 'Лена (рация)', text: 'Смотрите — у края, на уступе. Птенец. Выпал из гнезда, крыло разодрано.' }]);
        }
        // sentinels
        let seen = false;
        sentinels.forEach((s, i) => {
          s.look = s.base + Math.sin(Game.time * (0.8 + i * 0.13) + i * 2) * 1.2;
          s.g.rotation.y = s.look;
          s.g.userData.anim(dt, 0, { perched: true });
          if (S.stage === 'summit' || S.carrying) {
            const d = dist2d(pp.x, pp.z, s.x, s.z);
            const ang = Math.atan2(pp.x - s.x, pp.z - s.z);
            const range = P.crouch ? 15 : 30;
            if (d < range && Math.abs(wrapAngle(ang - s.look)) < 0.6) seen = true;
            if (d < 30 && P.crouch && !P.moving) { S.sentinelObs += dt; if (S.sentinelObs > 5) Journal.add('pte', 'b_sentinel'); }
          }
        });
        if (S.stage === 'summit' || S.carrying) {
          S.alarm = clamp(S.alarm + (seen ? dt * 0.6 : -dt * 0.12), 0, 1);
          HUD.danger(seen);
          const bars = Math.round(S.alarm * 6);
          HUD.timer(`КОЛОНИЯ ${'▮'.repeat(bars)}${'▯'.repeat(6 - bars)}`);
          if (S.alarm >= 1 && S.swarm <= 0) { S.swarm = 10; Sound.sfx('shriek', 1); Sound.sfx('wing', 1); HUD.say([{ who: 'Лена (рация)', text: 'Они поднялись! Итан, пригнитесь и уходите от гнёзд!' }], true); }
        }
        // flyers & dives
        if (S.swarm > 0) { S.swarm -= dt; if (S.swarm <= 0 && S.stage !== 'escape') S.alarm = 0.5; }
        const diving = S.swarm > 0 || S.stage === 'escape';
        if (diving) {
          S.diveT -= dt;
          if (S.diveT <= 0 && !flyers.some((f) => f.dive)) {
            S.diveT = S.stage === 'escape' ? rnd(2.4, 3.4) : rnd(2.8, 4);
            const f = pick(flyers);
            const tgt = new THREE.Vector3(pp.x, pp.y, pp.z);
            f.dive = { t: 0, from: f.g.position.clone(), tgt };
            Sound.sfx('whistle', 1);
          }
        }
        flyers.forEach((f, i) => {
          if (f.dive) {
            const dv = f.dive; dv.t += dt;
            diveShadow.position.set(dv.tgt.x, world.groundH(dv.tgt.x, dv.tgt.z) + 0.08, dv.tgt.z);
            shadowM.opacity = clamp(dv.t / 1.5, 0, 1) * 0.45; diveShadow.scale.setScalar(0.6 + dv.t * 0.5);
            const k = clamp(dv.t / 1.6, 0, 1);
            const pos = dv.from.clone().lerp(dv.tgt.clone().add(new THREE.Vector3(0, 1.2, 0)), k * k);
            f.g.position.copy(pos); f.g.lookAt(dv.tgt.x, dv.tgt.y + 1, dv.tgt.z);
            f.g.userData.anim(dt, 0, { dive: true });
            if (dv.t >= 1.6 && !dv.hit) {
              dv.hit = true; Sound.sfx('wing', 1.2);
              if (dist2d(pp.x, pp.z, dv.tgt.x, dv.tgt.z) < 2.6) {
                const left = P.hurt(1, new THREE.Vector3(dv.from.x, 0, dv.from.z));
                if (left <= 0) Game.fail('Сбиты с тропы', 'Слышите свист — уходите с места удара', () => ctx.restore());
              }
            }
            if (dv.t > 2.4) { f.dive = null; shadowM.opacity = 0; f.a = Math.atan2(f.g.position.z, f.g.position.x); }
          } else {
            f.a += f.sp * dt * (diving ? 2 : 1);
            const r = f.r * (diving ? 0.6 : 1);
            f.g.position.set(Math.cos(f.a) * r, PEAK_TOP + f.h + Math.sin(Game.time * 0.5 + i) * 2, Math.sin(f.a) * r);
            f.g.rotation.set(0, -f.a + (f.sp > 0 ? 0 : Math.PI), f.sp > 0 ? -0.35 : 0.35);
            f.g.userData.anim(dt, 0, { flap: Math.sin(Game.time * 0.7 + i) > 0.6 || diving });
          }
        });
        perched.forEach((b, i) => { b.userData.anim(dt, 0, { perched: S.swarm <= 0 && S.stage !== 'escape' }); if (S.swarm > 0 || S.stage === 'escape') b.position.y = PEAK_TOP + 0.4 + Math.abs(Math.sin(Game.time * 3 + i)) * 2; });
        chick.userData.anim(dt, 0, { perched: true });
        if (S.carrying) { const e = P.model.localToWorld(new THREE.Vector3(0, 1.2, 0.45)); chick.position.copy(e); chick.rotation.y = P.yaw; }
        // escape finish
        if (S.stage === 'escape' && np.t < 0.64) {
          S.stage = 'done'; HUD.timer(null); HUD.danger(false);
          (async () => {
            await HUD.say([{ who: 'Лена', text: 'Четыре. Итан… четыре из пяти.' }, { who: 'Хальм', text: 'Прямой путь к территории тираннозавра засыпан. Остаётся через кальдеру.' }]);
            Game.complete('truth');
          })();
        }
      },
      restore() {
        HUD.timer(null); HUD.danger(false);
        S.gust = null; S.nextGust = 8; S.alarm = 0; S.swarm = 0; flyers.forEach((f) => { f.dive = null; }); shadowM.opacity = 0;
        const spot = { start: 0.012, wreck: 0.3, relay: 0.46, summit: 0.985, escape: 0.985 }[S.cp] ?? 0.012;
        const p = at(spot), q = at(Math.min(1, spot + 0.02));
        Game.player.place(p.x, p.z, Math.atan2(q.x - p.x, q.z - p.z));
        if (S.cp === 'escape') { S.stage = 'escape'; }
        if (S.carrying) { S.carrying = false; chick.position.set(chickPos.x, PEAK_TOP, chickPos.z); world.speedMul = 1; }
      },
      dispose() { HUD.timer(null); world.speedMul = 1; },
    };
    // interactions
    world.interact({ x: rl.x, z: rl.z, r: 3, hold: 1.4, label: 'Настроить ретранслятор', enabled: () => !S.relay,
      onUse: () => {
        S.relay = true; S.cp = 'relay';
        HUD.say([{ who: 'Лукас (рация)', text: 'Слышу вас! Слышу! Следопыт, ты не представляешь, как я рад твоему голосу.' }, { who: 'Лукас (рация)', text: 'О Диего — ничего. Прости.' }]);
        HUD.objective('Поднимитесь к гнёздам', 'Вершина. Птеранодоны гнездятся на плато.');
      } });
    world.interact({ x: rl.x, z: rl.z, r: 3, label: 'Послушать эфир', enabled: () => S.relay && !S.eaves && !HUD.radioBusy(),
      onUse: () => { S.eaves = true; Game.state.flags.eavesdrop = true; HUD.say([{ who: '[Эфир · закрытый канал]', text: '<em>Хальм:</em> …три из пяти. Нет, они не знают. Да. Как в семнадцатом.', dur: 5 }, { who: 'Итан', text: '«Как в семнадцатом». D-04 — это семнадцатый год.', dur: 3.4 }]); } });
    world.interact({ x: wr.x, z: wr.z, r: 5, hold: 1, label: 'Осмотреть обломки вертолёта', enabled: () => !S.wreckRead,
      onUse: () => { S.wreckRead = true; HUD.say([{ who: '[Бортовой самописец D-02 · 2006]', text: '«Земля, это Дельта-два, прошли фронт… это не погода. Она… она включилась—»', dur: 5 }, { who: 'Итан', text: 'Вуаль включилась. Кто-то её включает.', dur: 3 }]); Game.state.flags.clueVeil = true; } });
    world.interact({ x: chickPos.x, z: chickPos.z, r: 2.4, hold: 0.8, label: 'Поднять птенца', enabled: () => S.stage === 'summit' && !S.carrying && !S.chickHome,
      onUse: () => { S.carrying = true; world.speedMul = 0.8; Sound.sfx('chick', 1); HUD.objective('Верните птенца в гнездо', 'Ближайшее гнездо с яйцами — в центре плато. Часовые всё ещё смотрят.'); } });
    world.interact({ x: 4, z: -6, r: 2.6, hold: 1, label: 'Вернуть птенца в гнездо', enabled: () => S.carrying,
      onUse: () => {
        S.carrying = false; S.chickHome = true; world.speedMul = 1;
        chick.position.set(4.3, PEAK_TOP + 0.4, -6); Sound.sfx('chick', 1);
        Journal.add('pte', 'b_care');
        HUD.objective('Возьмите кровь с царапины', 'Птенец в гнезде. Кровь на разодранном крыле свежая.');
        HUD.say([{ who: 'Лена (рация)', text: 'Вы вернули его… Итан, у него на крыле кровь. Свежая. Осторожно.' }]);
      } });
    world.interact({ x: 4.3, z: -6, r: 2.4, hold: 1.4, label: 'Взять кровь с крыла птенца', enabled: () => S.chickHome && !S.dna && !DNA.busy,
      interrupt: () => S.alarm > 0.9,
      onUse: async () => {
        S.dna = true;
        const ok = await DNA.collect('pte', true, 'PTERANODON');
        if (!ok) return;
        Journal.add('pte', 'dna');
        await wait(1.2);
        // lightning & rockfall — the colony rises
        lightning(world, 1, 0.3); Cam.shake = 1; Sound.sfx('crack', 1); Sound.sfx('thunder', 1);
        for (let i = 0; i < 10; i++) {
          const rock = mesh(rockGeo(i + 80), rockM, { parent: world.scene, pos: [rnd(-20, 20), PEAK_TOP + 30, rnd(-20, 20)], scale: rnd(0.6, 1.4) });
          let vy = 0;
          const fn = world.onUpdate((dt) => { vy -= 20 * dt; rock.position.y += vy * dt; const g = world.groundH(rock.position.x, rock.position.z); if (rock.position.y < g + 0.5) { rock.position.y = g + 0.5; world.updaters.splice(world.updaters.indexOf(fn), 1); Sound.sfx('thud', 0.3); } });
        }
        S.stage = 'escape'; S.cp = 'escape'; S.alarm = 1; S.swarm = 999;
        HUD.danger(true);
        HUD.timer(null);
        HUD.objective('Бегите вниз по тропе!', 'К осыпи на спуске. Слышите свист — уходите с места: там упадёт птеранодон.');
        HUD.say([{ who: 'Хальм (рация)', text: 'Вниз! Не останавливаться!' }, { who: 'Лена (рация)', text: 'Итан, слева!' }], true);
      } });
    return ctx;
  },
};
