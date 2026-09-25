// ============================================================
// 42-ch-valley.js — Chapter I: the valley, DNA 1 — Triceratops
// ============================================================
const _q2 = new THREE.Vector2();

class TriHerd {
  constructor(world, cx, cz) {
    this.world = world;
    this.center = new THREE.Vector2(cx, cz);
    this.goal = this.center.clone();
    this.members = [];
    this.state = 'graze';
    this.goalT = 25;
    this.onFlee = null;
    this.sightMul = 1;
    const roles = ['elder', 'adult', 'adult', 'maleA', 'maleB', 'adult', 'adult', 'calf', 'calf'];
    roles.forEach((role, i) => {
      const g = makeTriceratops({
        scale: role === 'calf' ? 0.46 : role === 'elder' ? 1.06 : rnd(0.9, 1.04), broken: role === 'elder',
        skin: role === 'elder' ? '#7c775d' : pick(['#6d6a4f', '#666248', '#72694c', '#6a6650']), frill: pick(['#8a4b2c', '#94532e', '#7c4a30']),
      });
      const a = (i / roles.length) * TAU + 0.3, rr = role === 'calf' ? 3 : role === 'elder' ? 5.5 : rnd(8, 12);
      const m = {
        g, role, off: new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr),
        pos: new THREE.Vector2(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr),
        yaw: rnd(0, TAU), speed: 0, alert: 0, wander: new THREE.Vector2(), wanderT: rnd(0, 5), graze: true, override: null,
        col: { x: 0, z: 0, r: role === 'calf' ? 1.1 : 2.3 }, scale: g.scale.x,
      };
      world.add(g); world.circles.push(m.col); this.members.push(m);
    });
    this.elder = this.members[0]; this.maleA = this.members[3]; this.maleB = this.members[4];
    this.calves = this.members.filter((m) => m.role === 'calf');
    this.charging = null;
  }
  reset(x, z) {
    this.center.set(x, z); this.goal.set(x, z); this.state = 'graze';
    this.members.forEach((m) => { m.pos.set(x + m.off.x, z + m.off.y); m.alert = 0; m.override = null; m.speed = 0; });
    this.charging = null;
  }
  maxAlert() { return this.members.reduce((a, m) => Math.max(a, m.alert), 0); }
  nearestDist(p) { let d = 1e9; for (const m of this.members) d = Math.min(d, dist2d(p.x, p.z, m.pos.x, m.pos.y)); return d; }
  flee(from) {
    const dx = this.center.x - from.x, dz = this.center.y - from.z, l = Math.hypot(dx, dz) || 1;
    let gx = this.center.x + (dx / l) * 60, gz = this.center.y + (dz / l) * 60;
    // keep inside the valley — fall back to the pasture farthest from the player
    if (Math.hypot(gx - VALLEY.center.x, gz - VALLEY.center.z) > 185) {
      let best = VALLEY.pastures[0], bd = -1;
      for (const p of VALLEY.pastures) { const d = dist2d(p[0], p[1], from.x, from.z); if (d > bd) { bd = d; best = p; } }
      gx = best[0]; gz = best[1];
    }
    this.goal.set(gx, gz);
    this.state = 'flee';
    this.members.forEach((m) => { if (m.override && m.override.type !== 'duel') m.override = null; });
    if (this.onFlee) this.onFlee();
  }
  update(dt, P, world) {
    const pp = P.pos;
    // herd centre
    const toGoal = _q2.copy(this.goal).sub(this.center);
    const gd = toGoal.length();
    const cs = this.state === 'flee' ? 5.2 : 0.35;
    if (gd > 0.5) this.center.addScaledVector(toGoal.normalize(), Math.min(gd, cs * dt));
    else if (this.state === 'flee') { this.state = 'graze'; this.goalT = 30; }
    if (this.state === 'graze') {
      this.goalT -= dt;
      if (this.goalT < 0) { this.goalT = rnd(25, 45); this.goal.set(this.center.x + rnd(-10, 10), this.center.y + rnd(-10, 10)); }
    }
    let alertSum = 0;
    for (const m of this.members) {
      // perception
      const d = dist2d(pp.x, pp.z, m.pos.x, m.pos.y);
      const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);
      const tx = (pp.x - m.pos.x) / (d || 1), tz = (pp.z - m.pos.y) / (d || 1);
      const facing = fx * tx + fz * tz;
      let sight = 0;
      const range = 52 * this.sightMul * (m === this.elder && this.elderWatch ? 1.45 : 1) * (P.crouch ? 0.5 : 1) * (P.moving ? 1 : 0.45);
      if (d < range && facing > -0.35) sight = (1 - d / range) * (P.moving ? 1.3 : 0.6);
      const hear = P.noise > 0 && d < P.noise * 2.3 ? 1.3 : 0;
      let scent = 0;
      if (d < 30) { const wx = world.wind.x, wz = world.wind.y; if (wx * -tx + wz * -tz > 0.8) scent = 0.55; }
      m.alert = clamp(m.alert + (sight + hear + scent) * dt - 0.22 * dt, 0, 1.6);
      alertSum += m.alert;
      if (m.alert > 0.35) m.lookAt = Math.atan2(pp.x - m.pos.x, pp.z - m.pos.y);
      else m.lookAt = null;
    }
    this.alertAvg = alertSum / this.members.length;
    if (this.state !== 'flee' && this.maxAlert() > 1.05) this.flee(pp);
    // calves: mothers charge intruders
    if (!this.charging && this.state !== 'flee') {
      for (const c of this.calves) {
        if (dist2d(pp.x, pp.z, c.pos.x, c.pos.y) < 12) {
          let mom = null, md = 1e9;
          for (const m of this.members) if (m.role === 'adult' || m.role === 'elder') { const d = dist2d(m.pos.x, m.pos.y, c.pos.x, c.pos.y); if (d < md) { md = d; mom = m; } }
          if (mom) { this.charging = mom; mom.override = { type: 'charge', t: 3.2, warn: 0.8 }; Sound.sfx('grunt', 1); Sound.sfx('grunt', 0.8); }
          break;
        }
      }
    }
    // members
    for (const m of this.members) {
      let tx, tz, speed, face = null, graze = false, alertAnim = m.alert > 0.35, charge = false;
      const o = m.override;
      if (o && o.type === 'charge') {
        o.warn -= dt;
        if (o.warn > 0) { tx = m.pos.x; tz = m.pos.y; speed = 0; face = Math.atan2(pp.x - m.pos.x, pp.z - m.pos.y); charge = true; }
        else {
          o.t -= dt; tx = pp.x; tz = pp.z; speed = 7.6; charge = true;
          if (dist2d(pp.x, pp.z, m.pos.x, m.pos.y) < 3.2) {
            Sound.sfx('thud', 1); const left = P.hurt(1, new THREE.Vector3(m.pos.x, 0, m.pos.y));
            m.override = null; this.charging = null; this.flee(pp);
            if (this.onHit) this.onHit(left);
          } else if (o.t <= 0) { m.override = null; this.charging = null; this.flee(pp); }
        }
      } else if (o && o.to) {
        tx = o.to.x; tz = o.to.y; speed = o.speed; face = o.face ?? null; graze = !!o.graze;
      } else {
        m.wanderT -= dt;
        if (m.wanderT < 0) { m.wanderT = rnd(4, 9); m.wander.set(rnd(-3, 3), rnd(-3, 3)); }
        tx = this.center.x + m.off.x + m.wander.x; tz = this.center.y + m.off.y + m.wander.y;
        speed = this.state === 'flee' ? (m.role === 'calf' ? 5.6 : 6.1) : 1.3;
        graze = this.state === 'graze' && !alertAnim;
      }
      const dx = tx - m.pos.x, dz = tz - m.pos.y, dd = Math.hypot(dx, dz);
      let v = 0;
      if (dd > 1.2 && speed > 0) { v = Math.min(speed, dd * 1.2); m.pos.x += (dx / dd) * v * dt; m.pos.y += (dz / dd) * v * dt; }
      m.speed = damp(m.speed, v, 6, dt);
      const want = face !== null ? face : v > 0.3 ? Math.atan2(dx, dz) : m.yaw;
      m.yaw = dampAngle(m.yaw, want, v > 3 ? 4 : 2, dt);
      if (m.speed > 0.4) graze = false;
      m.graze = graze;
    }
    // separation
    for (let i = 0; i < this.members.length; i++) for (let j = i + 1; j < this.members.length; j++) {
      const a = this.members[i], b = this.members[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.y - a.pos.y, d = Math.hypot(dx, dz), min = (a.col.r + b.col.r) * 0.95;
      if (d < min && d > 0.01) { const push = (min - d) * 0.5; a.pos.x -= (dx / d) * push; a.pos.y -= (dz / d) * push; b.pos.x += (dx / d) * push; b.pos.y += (dz / d) * push; }
    }
    for (const m of this.members) {
      m.g.position.set(m.pos.x, world.groundH(m.pos.x, m.pos.y), m.pos.y);
      m.g.rotation.y = m.yaw;
      m.col.x = m.pos.x; m.col.z = m.pos.y;
      const look = m.lookAt !== null && m.lookAt !== undefined ? clamp(wrapAngle(m.lookAt - m.yaw), -0.7, 0.7) : 0;
      m.g.userData.anim(dt, m.speed, { graze: m.graze, alert: m.alert > 0.35 && m.speed < 1, look, charge: m.override && m.override.type === 'charge' });
    }
  }
}

function makeCarcass(world, x, z) {
  const g = new THREE.Group();
  const bone = mat('#cfc6ab', { rough: 0.7 }), flesh = mat('#5a2f24');
  for (let i = 0; i < 8; i++) {
    const r = mesh(new THREE.TorusGeometry(1.25 - Math.abs(i - 3.5) * 0.1, 0.07, 5, 10, Math.PI * 1.1), bone, { parent: g, pos: [0, 0.2, -1.6 + i * 0.42], rot: [0, Math.PI / 2, Math.PI * 0.95] });
    r.rotation.order = 'YXZ';
  }
  mesh(G.cyl(0.12, 0.12, 4.4, 6), bone, { parent: g, rot: [Math.PI / 2, 0, 0], pos: [0, 0.9, 0] });
  mesh(G.sphere(1, 8, 6), flesh, { parent: g, pos: [0, 0.2, -0.3], scale: [1.1, 0.35, 1.6] });
  const skull = new THREE.Group(); skull.position.set(0.4, 0.4, 2.8); skull.rotation.set(0.2, 0.4, 0.5); g.add(skull);
  mesh(G.box(0.9, 0.7, 1.4), bone, { parent: skull });
  mesh(G.cyl(1.2, 1.2, 0.1, 12), bone, { parent: skull, rot: [Math.PI / 2 - 0.4, 0, 0], pos: [0, 0.5, -0.4] });
  mesh(G.cone(0.14, 1.0, 6), bone, { parent: skull, rot: [1.1, 0, 0], pos: [0.3, 0.5, 0.4] });
  g.position.set(x, world.groundH(x, z), z); g.rotation.y = 0.7;
  world.add(g);
  world.circles.push({ x, z, r: 2.2 });
  return g;
}

// the flight in: crew in the cabin, the Veil, the reveal, landing and disembarking
function flightIntro(world, herd) {
  const heli = makeHelicopter({ label: 'D-05', onGround: false, rpm: 1 });
  heli.rotation.order = 'YXZ';
  world.add(heli);
  heli.userData.engine.managed = true;
  const crew = {};
  [['lucas', 0, 'flight'], ['halm', 1], ['lena', 2], ['diego', 4]].forEach(([k, seat, v]) => { const n = makeNPC(k, v); world.add(n); heli.userData.seat(n, seat); crew[k] = n; });
  heli.userData.cabinLight.intensity = 0.45;
  const pts = [V(0, 72, 980), V(0, 68, 760), V(4, 62, 560), V(12, 52, 360), V(46, 46, 200), V(112, 42, 40), V(138, 36, -58), V(100, 34, -128), V(24, 34, -92), V(-48, 30, -34), V(-46, 22, 78), V(-14, 10, 150), V(VALLEY.pad.x, valleyHeight(VALLEY.pad.x, VALLEY.pad.z), VALLEY.pad.z)];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const T = 52; let t = 0; let active = true; let heading = 0, bank = 0;
  const fog = world.scene.fog, baseNear = fog.near, baseFar = fog.far;
  const loc = (x, y, z) => () => heli.localToWorld(new THREE.Vector3(x, y, z));
  const uOf = (k) => (k < 0.85 ? (k / 0.85) * 0.955 : 0.955 + (1 - Math.pow(1 - (k - 0.85) / 0.15, 2)) * 0.045);
  herd.goal.set(VALLEY.pastures[1][0], VALLEY.pastures[1][1]); herd.state = 'flee';
  const pm = () => Game.player.model;
  let shake = 0;
  world.onUpdate((dt) => {
    heli.userData.update(dt);
    if (!active) return;
    t += dt * Cine.speed;
    const k = clamp(t / T, 0, 1), u = uOf(k);
    const p = curve.getPointAt(u), p2 = curve.getPointAt(Math.min(1, u + 0.004));
    heli.position.copy(p);
    if (Math.hypot(p2.x - p.x, p2.z - p.z) > 0.25) { const nh = Math.atan2(p2.x - p.x, p2.z - p.z); bank = damp(bank, clamp(wrapAngle(nh - heading) * 18, -0.35, 0.35), 2, dt); heading = nh; }
    const flare = smoothstep(0.9, 1, k);
    heli.rotation.set(-0.08 * (1 - flare) + flare * 0.1, heading, -bank * (1 - flare));
    // the Veil: fog closes in while crossing the cloud wall, opens on the island side
    const inVeil = smoothstep(11, 15, t) * (1 - smoothstep(23.5, 26.5, t));
    fog.near = lerp(baseNear, 2, inVeil); fog.far = lerp(baseFar + 300, 38, inVeil);
    fog.color.set(inVeil > 0.5 ? '#5a6168' : TIME_PRESETS[world.timeKey].fog);
    if (world.rain) world.rain.visible = inVeil > 0.2;
    heli.userData.body.rotation.z = Math.sin(t * 7) * 0.02 * inVeil;
    if (k >= 1) { active = false; heli.position.y = valleyHeight(heli.position.x, heli.position.z); heli.rotation.set(0, heading, 0); }
  });
  const sit = (k, dt) => pm().userData.anim(dt || 0.016, 0, { sit: true });
  const shots = [
    { from: () => heli.position.clone().add(V(22, 2, -34)), to: () => heli.position.clone().add(V(16, 3, -20)), look: () => heli.position.clone().add(V(0, 2, 0)), dur: 6, cut: true, fov: 46, rigid: true,
      onStart: () => { Sound.bed('wind', 0.12); HUD.say([{ who: 'Лукас', text: 'Дамы и господа, говорит ваш капитан. Напитков не будет, парашютов тоже.', dur: 3.6 }, { who: 'Нора (радио)', text: 'Дельта-пять, «Порог». Курс подтверждаю. Удачи вам.', dur: 2.6 }]); } },
    { from: loc(-0.2, 2.28, -1.5), look: loc(0.2, 2.0, 5), dur: 6, cut: true, fov: 60, rigid: true, onUpdate: sit,
      onStart: () => { crew.lena.userData.pose = { sit: true, lookY: 0.9 }; HUD.say([{ who: 'Лена', text: 'Это она? Вуаль?', dur: 2.2 }, { who: 'Хальм', text: 'Сорок лет облаков на одном месте. Погода так не умеет.', dur: 3.4 }]); } },
    { from: loc(0.05, 2.05, 1.7), look: loc(0.1, 1.62, 3.0), dur: 5, cut: true, fov: 52, rigid: true, onUpdate: sit,
      onStart: () => { HUD.say([{ who: 'Лукас', text: 'У меня компас пляшет. Да все приборы пляшут.', dur: 2.8 }, { who: 'Нора (радио)', text: 'Дельта-пять… вас не… повто…', dur: 2.4 }]); setTimeout(() => lightning(world, 1, 0.6), 2500); } },
    { from: loc(-8, 3, -14), to: loc(-5, 2.6, -11), look: loc(0, 1.5, 4), dur: 5, cut: true, fov: 58, rigid: true,
      onStart: () => { Cam.shake = 0.5; Sound.bed('rain', 0.14); HUD.say([{ who: 'Хальм', text: 'Это нормально. Держите курс на ноль-восемь-пять.', dur: 2.6 }, { who: 'Лукас', text: 'Нормально? Откуда вы знаете, что нормально?', dur: 2.4 }]); setTimeout(() => lightning(world, 1, 0.2), 1800); },
      onUpdate: () => { Cam.shake = Math.max(Cam.shake, 0.25); } },
    { from: loc(-0.3, 2.25, -1.4), look: loc(0.3, 1.9, 3), dur: 4.5, cut: true, fov: 62, rigid: true,
      onStart: () => { crew.lena.userData.pose = { sit: true, hold: true }; crew.diego.userData.pose = { sit: true, hold: true }; Sound.sfx('thud', 0.5); setTimeout(() => lightning(world, 1.2, 0.1), 900); },
      onUpdate: (k, dt) => { sit(k, dt); Cam.shake = Math.max(Cam.shake, 0.35 * (1 - k)); if (k > 0.85 && !shake) { shake = 1; HUD.flash(0.9, 1.2); Sound.silenceAll(0.6); } } },
    { from: V(170, 9, -40), to: V(166, 11, -62), look: () => V(herd.center.x, 3, herd.center.y).lerp(heli.position, 0.28), dur: 11, cut: true, fov: 52,
      onStart: () => { heli.userData.cabinLight.intensity = 0.3; Sound.bed('wind', 0.08); Sound.theme(0.1); setTimeout(() => HUD.big('UMBRA', 'Expedition D-05', 'title', 5), 2500); setTimeout(() => HUD.say([{ who: 'Лена', text: '<em>(шёпотом)</em> Они живые. Они настоящие.', dur: 3 }]), 7500); } },
    { from: loc(0.1, 2.1, 1.75), look: loc(0.62, 2.02, 0.85), dur: 5, cut: true, fov: 42, rigid: true, onUpdate: sit,
      onStart: () => { crew.lena.userData.pose = { sit: true, lookY: 1.05 }; crew.diego.userData.pose = { sit: true }; HUD.say([{ who: 'Диего', text: 'Скажи это ещё раз, когда будем внизу.', dur: 2.6 }, { who: 'Лена', text: 'Они живые, Диего.', dur: 2 }]); } },
    { from: V(-30, 14, -44), to: V(-32, 15, -36), look: () => V(-62, 15, -18).lerp(heli.position, 0.35), dur: 6, cut: true, fov: 50 },
    { from: () => V(-26, valleyHeight(-26, 184) + 1.8, 184), to: () => V(-22, valleyHeight(-22, 181) + 1.7, 181), look: () => heli.position.clone().add(V(0, 1.5, 0)), dur: 8.5, cut: true, fov: 50,
      onStart: () => { Sound.bed('insects', 0.05); Sound.bed('wind', 0.06); } },
    // touchdown: door slides open, the team steps out
    { from: loc(7, 1.7, 5), to: loc(6.2, 1.6, 4.2), look: loc(1.6, 1.3, 0.2), dur: 7, cut: true, fov: 48,
      onStart: () => { heli.userData.openDoor(true); heli.userData.idle(); setTimeout(() => heli.userData.stop(), 3500); disembark(); } },
  ];
  const door = () => { const d = heli.localToWorld(V(2.4, 0, 0.7)); d.y = valleyHeight(d.x, d.z); return d; };
  const walkers = {};
  function disembark() {
    const d = door();
    const out = [['halm', 0, [[-14, 152]], null], ['diego', 0.9, [[-11, 143]], null], ['lena', 1.8, [[d.x + 2.2, d.z - 1.2]], null]];
    for (const [k, delay] of out) {
      setTimeout(() => {
        const n = crew[k];
        world.scene.attach(n);
        n.userData.pose = null; n.userData.seated = false;
        n.position.set(d.x, d.y, d.z);
        const c = new Companion(world, n);
        walkers[k] = c;
        const tgt = out.find((o) => o[0] === k)[2];
        c.walk(tgt);
      }, delay * 1000 / Math.max(1, Cine.speed));
    }
  }
  return { heli, crew, walkers, shots, door, done: () => !active };
}

CHAPTERS.valley = {
  create(o = {}) {
    const { world, brachios } = buildValleyWorld({ time: 'day' });
    makeRain(world).visible = false;
    const herd = new TriHerd(world, VALLEY.pastures[0][0], VALLEY.pastures[0][1]);
    herd.reset(VALLEY.pastures[0][0], VALLEY.pastures[0][1]);
    const S = { phase: 'arrive', leadLine: 0, traces: 0, seen: false, observe: 0, duel: 'none', dna: false, braSeen: false, silence: 'none', carcass: false, herdSeenT: 0, fleeCount: 0, bloodPos: null };
    // footprints along the trail
    const tr = VALLEY.trail;
    for (let i = 0; i < tr.length - 1; i++) {
      const [ax, az] = tr[i], [bx, bz] = tr[i + 1];
      const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 2.6);
      const ry = Math.atan2(bx - ax, bz - az);
      for (let k = 0; k < n; k++) {
        const t = k / n, side = (k % 2 ? 1 : -1) * 0.8;
        const x = lerp(ax, bx, t) + Math.cos(ry) * side, z = lerp(az, bz, t) - Math.sin(ry) * side;
        decal(world, x, z, { size: 1.1, ry: ry + Math.PI });
      }
    }
    // dung
    const [dx, dz] = VALLEY.traces.dung;
    const dung = new THREE.Group();
    for (let i = 0; i < 5; i++) mesh(G.sphere(0.35, 7, 5), mat('#4a3a22'), { parent: dung, pos: [rnd(-0.5, 0.5), 0.15, rnd(-0.5, 0.5)], scale: [1, 0.6, 1] });
    dung.position.set(dx, world.groundH(dx, dz), dz); world.add(dung);
    makeFlies(world, dx, world.groundH(dx, dz), dz);
    // chewed cycads
    const [cx, cz] = VALLEY.traces.cycad;
    for (let i = 0; i < 3; i++) {
      const x = cx + rnd(-3, 3), z = cz + rnd(-3, 3);
      const st = new THREE.Group();
      mesh(G.cyl(0.3, 0.42, 0.9, 7), mat('#5a4630'), { parent: st, pos: [0, 0.45, 0] });
      mesh(G.cyl(0.26, 0.26, 0.04, 7), mat('#b8c47a', { emissive: '#2a3010' }), { parent: st, pos: [0, 0.92, 0] });
      for (let k = 0; k < 4; k++) mesh(G.box(0.2, 0.04, 0.9), mat('#4b7a36'), { parent: st, pos: [rnd(-1, 1), 0.03, rnd(-1, 1)], rot: [0, rnd(0, TAU), 0] });
      st.position.set(x, world.groundH(x, z), z); world.add(st);
    }
    // carcass & compies
    makeCarcass(world, VALLEY.carcass.x, VALLEY.carcass.z);
    const compies = [];
    for (let i = 0; i < 6; i++) {
      const c = makeCompy(); world.add(c);
      const a = rnd(0, TAU);
      compies.push({ g: c, home: new THREE.Vector2(VALLEY.carcass.x + Math.cos(a) * 2.6, VALLEY.carcass.z + Math.sin(a) * 2.6), pos: new THREE.Vector2(VALLEY.carcass.x + Math.cos(a) * 2.6, VALLEY.carcass.z + Math.sin(a) * 2.6), yaw: a, flee: 0 });
    }
    // the team: in the flight version they arrive in the helicopter, from chapter select they are already at camp
    let flight = null;
    const team = {};
    const HEAD = 0.51; // landing heading: the cabin door faces the camp side
    if (o.flight) flight = flightIntro(world, herd);
    else {
      const h = makeHelicopter({ label: 'D-05' }); h.position.set(VALLEY.pad.x, world.groundH(VALLEY.pad.x, VALLEY.pad.z), VALLEY.pad.z); h.rotation.y = HEAD; world.add(h); world.onUpdate((dt) => h.userData.update(dt));
      const pilot = makeNPC('lucas'); world.add(pilot); h.userData.seat(pilot, 0);
      [['halm', -14, 152], ['diego', -11, 143], ['lena', -10, 158]].forEach(([k, x, z]) => { const n = makeNPC(k); n.position.set(x, world.groundH(x, z), z); world.add(n); team[k] = new Companion(world, n); });
    }
    for (const z of [2.2, 0, -2.2, -5]) world.circles.push({ x: VALLEY.pad.x + Math.sin(HEAD) * z, z: VALLEY.pad.z + Math.cos(HEAD) * z, r: z < -3 ? 0.7 : 1.45 });
    const lena = () => (flight ? flight.walkers.lena : team.lena);
    // the camp generator hums: audible near camp, gone when you walk away
    let genE = null;
    world.onUpdate(() => {
      const g = world.campGen, p = Game.player;
      if (!g || !Sound.ctx || !p) return;
      const d = dist2d(p.pos.x, p.pos.z, g.x, g.z);
      if (d < 70 && !genE) { genE = Sound.emitter('gen', { ref: 3, rolloff: 1.4, gain: 0.45, rate: 1 }); genE.setPos(new THREE.Vector3(g.x, g.y, g.z)); }
      else if (d > 85 && genE) { genE.stop(1.2); genE = null; }
    });
    // raptor silhouette for the insect-silence lesson
    const shadowRaptor = makeRaptor({ skin: '#3d3d34' }); shadowRaptor.visible = false; world.add(shadowRaptor);

    const P = () => Game.player;
    const traceText = {
      print: ['[Сканер]', 'TRICERATOPS · взрослый, ~6 т · свежесть: 3 ч · направление: северо-восток'],
      dung: ['[Сканер]', 'ПОМЁТ · TRICERATOPS · свежесть: 2 ч · рацион: саговники, хвощи. Мухи — значит свежий.'],
      cycad: ['[Сканер]', 'ОБЪЕДЕНО · свежий сок на срезах · стадо ближе 200 м'],
    };
    const lenaAfter = {
      print: 'Отпечатки! Шаг длинный — они шли спокойно. Идите по следу, Итан.',
      dung: 'Два часа. Мы их догоняем.',
      cycad: 'Они едят саговники под корень. Садовники… Стадо совсем рядом — пригнитесь.',
    };
    const journalId = { print: 't_print', dung: 't_dung', cycad: 't_cycad' };
    const nextTrace = () => ['print', 'dung', 'cycad'].find((k) => !S['tr_' + k]);
    const traceObjective = () => {
      if (S.traces === 1) HUD.objective('Идите по следу', 'Отпечатки ведут на северо-восток. Изучайте всё, что оставило стадо.');
      else if (S.traces === 2) HUD.objective('Идите по следу', 'Ещё один след — и стадо будет рядом.');
      else if (S.traces >= 3 && !S.seen) HUD.objective('Найдите стадо', 'Судя по следам, трицератопсы пасутся за скалами на северо-востоке.');
    };
    for (const key of ['print', 'dung', 'cycad']) {
      const [x, z] = VALLEY.traces[key];
      world.interact({
        x, z, r: 3.2, hold: 0.9, label: key === 'print' ? 'Изучить отпечатки' : key === 'dung' ? 'Изучить помёт' : 'Изучить объеденные саговники',
        enabled: () => !S['tr_' + key],
        onUse: () => {
          S['tr_' + key] = true; S.traces++;
          Sound.sfx('ping');
          HUD.say([{ who: traceText[key][0], text: traceText[key][1], dur: 4 }, { who: 'Лена', text: lenaAfter[key] }]);
          Journal.add('tri', journalId[key]);
          if (S.phase !== 'hunt') { S.phase = 'hunt'; lena().follow({ dist: 2.8 }); }
          traceObjective();
          S.lastCp = { x, z };
        },
      });
    }
    world.interact({
      x: VALLEY.carcass.x, z: VALLEY.carcass.z, r: 3.4, hold: 1.2, label: 'Взять образец с туши', enabled: () => !S.carcass && !DNA.busy,
      onUse: async () => {
        S.carcass = true;
        await DNA.collect('tri', false, 'TRICERATOPS');
        HUD.say([{ who: 'Лена', text: 'Капсула не принимает. Клетки мёртвые — туше недели две.', dur: 3.4 }, { who: 'Лена', text: 'Нам нужна живая ткань. Свежая кровь, перо — что угодно от живого животного.' }]);
      },
    });
    // blood sample
    const bloodInteract = world.interact({
      x: 0, z: 0, r: 2.4, hold: 1.8, label: 'Взять мазок крови с папоротника', enabled: () => S.duel === 'done' && !S.dna && !DNA.busy,
      warn: () => (S.loserNear ? 'Раненый самец рядом — подождите, пока он уйдёт' : null),
      interrupt: () => herd.maxAlert() > 0.7,
      onUse: async () => {
        S.dna = true;
        Journal.add('tri', 't_blood', true);
        const ok = await DNA.collect('tri', true, 'TRICERATOPS');
        if (ok) {
          Journal.add('tri', 'dna');
          HUD.objective('DNA COLLECTION 1/5', 'Возвращайтесь в лагерь «Эхо» до темноты.');
          await wait(1.2);
          await HUD.say([{ who: 'Лена', text: 'Первый. Итан… у нас первый. Осталось четыре.' }, { who: 'Хальм (рация)', text: 'Хорошая работа, мистер Рид. Возвращайтесь в лагерь до темноты.' }]);
          await wait(1.5);
          await HUD.say([{ who: 'Лукас (рация)', text: 'У меня в эфире маяк. Зациклен. Код… D-01.' }, { who: 'Хальм (рация)', text: 'Старое оборудование. Игнорируем.' }, { who: 'Лена', text: 'Зона рапторов — в той же стороне, Виктор.' }]);
          await wait(1);
          Game.complete('k4');
        }
      },
    });

    async function runDuel() {
      S.duel = 'running';
      const A = herd.maleA, B = herd.maleB;
      const pp = P().pos;
      const c = herd.center;
      const dir = new THREE.Vector2(pp.x - c.x, pp.z - c.y).normalize();
      const perp = new THREE.Vector2(-dir.y, dir.x);
      const spot = c.clone().addScaledVector(dir, 15);
      if (dist2d(spot.x, spot.y, pp.x, pp.z) < 24) spot.copy(c).addScaledVector(dir, Math.max(4, dist2d(c.x, c.y, pp.x, pp.z) - 26));
      const aPos = spot.clone().addScaledVector(perp, 6), bPos = spot.clone().addScaledVector(perp, -6);
      A.override = { type: 'duel', to: aPos, speed: 1.8 }; B.override = { type: 'duel', to: bPos, speed: 1.8 };
      HUD.say([{ who: 'Лена', text: 'Смотрите! Двое самцов уходят от стада…' }]);
      for (let i = 0; i < 80 && (A.pos.distanceTo(aPos) > 1.6 || B.pos.distanceTo(bPos) > 1.6); i++) await wait(0.1);
      A.override.face = Math.atan2(B.pos.x - A.pos.x, B.pos.y - A.pos.y); B.override.face = Math.atan2(A.pos.x - B.pos.x, A.pos.y - B.pos.y);
      Sound.sfx('grunt', 1); await wait(0.9); Sound.sfx('grunt', 1); await wait(1.2);
      HUD.say([{ who: 'Лена', text: 'Спор за стадо. Смотрите на левого — он проиграет, он уже боится.' }]);
      Cam.pull = { x: spot.x, z: spot.y, strength: 2.6, time: 2.6 };
      A.override = { type: 'duel', to: spot.clone().addScaledVector(perp, 2.2), speed: 6.5, face: A.override.face };
      B.override = { type: 'duel', to: spot.clone().addScaledVector(perp, -2.2), speed: 6.5, face: B.override.face };
      for (let i = 0; i < 40 && A.pos.distanceTo(B.pos) > 5.2; i++) await wait(0.05);
      const near = dist2d(spot.x, spot.y, P().pos.x, P().pos.z);
      Sound.sfx('crack', Sound.vol(near, 10, 140)); Sound.sfx('thud', Sound.vol(near, 10, 140));
      if (near < 60) Cam.shake = 0.35;
      if (near < 110) Journal.add('tri', 'b_duel');
      S.duelVisible = true;
      for (let i = 0; i < 26; i++) {
        const s = Math.sin(i * 0.9) * 0.9;
        A.override.to = spot.clone().addScaledVector(perp, 2.2 + s); B.override.to = spot.clone().addScaledVector(perp, -2.2 + s);
        if (i % 6 === 0) { Sound.sfx('crack', Sound.vol(near, 10, 140) * 0.6); Sound.sfx('grunt', Sound.vol(near, 10, 140)); }
        await wait(0.16);
      }
      S.duelVisible = false;
      // loser retreats and bleeds
      A.override = null;
      const away = spot.clone().addScaledVector(perp, -13).addScaledVector(dir, -3);
      B.override = { type: 'duel', to: away, speed: 1.3 };
      let lastDrop = B.pos.clone();
      bloodDecal(world, B.pos.x, B.pos.y, 0.9);
      for (let i = 0; i < 120 && B.pos.distanceTo(away) > 1.4; i++) {
        if (B.pos.distanceTo(lastDrop) > 2.4) { bloodDecal(world, B.pos.x, B.pos.y, rnd(0.6, 0.9)); lastDrop = B.pos.clone(); }
        await wait(0.1);
      }
      S.bloodPos = B.pos.clone();
      for (let i = 0; i < 4; i++) bloodDecal(world, S.bloodPos.x + rnd(-0.8, 0.8), S.bloodPos.y + rnd(-0.8, 0.8), rnd(0.8, 1.3));
      bloodInteract.x = S.bloodPos.x; bloodInteract.z = S.bloodPos.y;
      S.duel = 'done';
      S.loserNear = true;
      herd.elderWatch = true;
      HUD.objective('Возьмите образец крови', 'Кровь проигравшего самца осталась на папоротнике. Не встревожьте стадо — Старуха теперь следит внимательнее.');
      HUD.say([{ who: 'Лена', text: 'Кровь на папоротнике. Свежая. Это наш образец, Итан. Только тихо — Старуха вас чувствует.' }]);
      await wait(14);
      B.override = null; S.loserNear = false;
      await wait(30);
      herd.elderWatch = false;
    }

    herd.onFlee = () => {
      S.fleeCount++;
      if (S.seen) Journal.add('tri', 'b_alarm');
      if (S.fleeCount === 1 || S.fleeCount % 3 === 0) HUD.say([{ who: 'Лена', text: 'Вы их спугнули. Дайте им успокоиться и подходите пригнувшись — лучше с подветренной стороны.' }]);
      Sound.sfx('horn', 0.6);
    };
    herd.onHit = (left) => {
      if (left <= 0) Game.fail('Итан без сознания', 'Мать защищала детёныша', () => ctx.restore());
      else HUD.say([{ who: 'Лена', text: 'Итан! Вы целы? Не подходите к детёнышам — матери бросаются без предупреждения.' }], true);
    };

    const ctx = {
      world,
      spawn: o.flight ? { x: -11, z: 159, yaw: Math.PI * 0.95 } : { x: -12, z: 154, yaw: Math.PI * 0.95 },
      async start(opts = {}) {
        Sound.bed('wind', 0.06); Sound.bed('insects', 0.05);
        const P = Game.player;
        if (flight) {
          HUD.show(false);
          flight.heli.userData.seat(P.model, 3);
          await Cine.play(flight.shots, { skippable: true });
          // step out of the cabin
          const d = flight.door();
          world.scene.attach(P.model);
          P.model.userData.pose = null; P.model.userData.seated = false;
          P.place(d.x + 1.2, d.z + 0.4, -2.6);
          Cam.yaw = P.yaw + Math.PI; Cam.pitch = 0.18; Cam.curPos.copy(camera.position);
          HUD.show(true);
          herd.reset(VALLEY.pastures[0][0], VALLEY.pastures[0][1]);
          Sound.bed('wind', 0.06); Sound.bed('insects', 0.05);
          await HUD.say([{ who: 'Хальм', text: 'Лагерь «Эхо» — за палатками. Здесь стояла передовая группа D-04. Разбиваем базу и выходим на связь с «Порогом».' }, { who: 'Лена', text: 'Здесь кто-то был. Лет пять-десять назад.' }, { who: 'Лукас', text: '<em>(вдыхает)</em> Пахнет… как в оранжерее, где кто-то умер.' }]);
        }
        S.phase = 'lead';
        HUD.objective('Идите с Леной к озеру', 'Лена покажет, где начинать поиск. Трицератопсы пасутся за озером, на северо-востоке.');
        HUD.say([{ who: 'Лена', text: 'Итан, трицератопсы пасутся за озером. Идёмте со мной — начнём со следов у берега.' }]);
        const c = lena();
        c.lead(LEAD_PATH, { wait: 13, calls: [{ who: 'Лена', text: 'Итан! Сюда, к озеру. Не отставайте.' }, { who: 'Лена', text: 'Итан, я здесь. Идём по тропе на север.' }],
          onArrive: () => {
            if (S.phase !== 'lead') return;
            S.phase = 'print';
            c.setHold(c.pos.x, c.pos.y, null);
            HUD.objective('Изучите отпечатки', 'Следы у берега прямо перед Леной. Подойдите и удерживайте E.');
            HUD.say([{ who: 'Лена', text: 'Стойте. Видите? Отпечатки. Свежие. Изучите их — удерживайте E.' }]);
          } });
        setTimeout(() => Tutorial.show('sprint', IS_TOUCH ? 'Джойстик до упора — бег. Лена побежит следом' : 'Удерживайте <kbd>Shift</kbd>, чтобы бежать. Лена побежит следом', () => Input.running() && P.speed > 5, { max: 14, valid: () => S.phase === 'lead' }), 5000);
      },
      markers() {
        const m = [{ x: VALLEY.camp.x, z: VALLEY.camp.z, label: 'лагерь' }];
        if (S.phase === 'lead') { const l = lena().pos; m.push({ x: l.x, z: l.y, label: 'Лена', goal: true, near: 9 }); return m; }
        const n = nextTrace();
        if (n && !S.seen) m.push({ x: VALLEY.traces[n][0], z: VALLEY.traces[n][1], label: 'след', goal: true, near: 4 });
        if (S.traces >= 3 && !S.seen) m.push({ x: herd.center.x + 15, z: herd.center.y - 10, label: 'стадо?', goal: true, near: 70 });
        if (S.seen && S.duel !== 'done') m.push({ x: herd.center.x, z: herd.center.y, label: 'стадо', goal: true, near: 85, patient: true });
        if (S.duel === 'done' && !S.dna && S.bloodPos) m.push({ x: S.bloodPos.x, z: S.bloodPos.y, label: 'кровь', cls: 'bad', goal: true, near: 3 });
        return m;
      },
      subjects() {
        const out = herd.members.map((m) => {
          let tag = '', item = null, special = false;
          if (S.duelVisible && (m === herd.maleA || m === herd.maleB)) { tag = 'Поединок'; item = 'b_duel'; special = true; }
          else if (m === herd.elder) { tag = 'Старуха'; item = 'b_elder'; special = true; }
          else if (m.role === 'calf') { tag = 'Детёныш'; item = 'b_calves'; special = true; }
          else if (m.graze) { tag = 'Выпас'; item = 'b_graze'; }
          return { sp: 'tri', obj: m.g, size: m.role === 'calf' ? 3 : 7, lift: 2, tag, item, special };
        });
        brachios.forEach((b) => out.push({ sp: 'bra', obj: b, size: 16, lift: 8, tag: b.userData.drinking ? 'Питьё' : '', item: b.userData.drinking ? 'b_drink' : null, special: b.userData.drinking, maxDist: 220 }));
        return out;
      },
      update(dt) {
        const p = P();
        herd.update(dt, p, world);
        // Lena's commentary on the walk to the lake: the island's first rules, taught on the move
        if (S.phase === 'lead') {
          const left = lena().path.length;
          if (S.leadLine === 0 && left <= 5) { S.leadLine = 1; HUD.say([{ who: 'Лена', text: 'Смотрите под ноги, не только по сторонам. Трава примята — здесь что-то проходило.' }]); }
          if (S.leadLine === 1 && left <= 3) { S.leadLine = 2; HUD.say([{ who: 'Лена', text: 'Карте D-04 два года. Стадо могло уйти. Поэтому — следы.' }]); }
        }
        // compies
        for (const c of compies) {
          const d = dist2d(p.pos.x, p.pos.z, c.pos.x, c.pos.y);
          if (d < 8) c.flee = 3;
          c.flee -= dt;
          let tx = c.home.x, tz = c.home.y, sp = 1.2;
          if (c.flee > 0) { const ax = c.pos.x - p.pos.x, az = c.pos.y - p.pos.z, l = Math.hypot(ax, az) || 1; tx = c.pos.x + (ax / l) * 10; tz = c.pos.y + (az / l) * 10; sp = 6; }
          const dx = tx - c.pos.x, dz = tz - c.pos.y, dd = Math.hypot(dx, dz);
          let v = 0; if (dd > 0.4) { v = Math.min(sp, dd * 2); c.pos.x += (dx / dd) * v * dt; c.pos.y += (dz / dd) * v * dt; c.yaw = dampAngle(c.yaw, Math.atan2(dx, dz), 8, dt); }
          else c.yaw = dampAngle(c.yaw, Math.atan2(VALLEY.carcass.x - c.pos.x, VALLEY.carcass.z - c.pos.y), 4, dt);
          c.g.position.set(c.pos.x, world.groundH(c.pos.x, c.pos.y), c.pos.y); c.g.rotation.y = c.yaw;
          c.g.userData.anim(dt, v, { peck: v < 0.3 });
        }
        // first sight of the brachiosaurs
        if (!S.braSeen && dist2d(p.pos.x, p.pos.z, brachios[0].position.x, brachios[0].position.z) < 80) {
          S.braSeen = true;
          Journal.add('bra', 'seen');
          Cam.pull = { x: brachios[0].position.x, z: brachios[0].position.z, strength: 2.2, time: 2.2 };
          HUD.say([{ who: 'Лена', text: 'Итан… не двигайтесь. Просто смотрите.', dur: 3 }, { who: 'Лена', text: 'Слышите насекомых? Они не замолчали. Значит, это не охотник. Запомните это.' }, { who: 'Лена', text: 'Камера. Сфотографируйте его. Пожалуйста.' }]).then(() => {
            Tutorial.show('photo', IS_TOUCH ? 'Кнопка <kbd>Камера</kbd> — снимок для журнала' : '<kbd>F</kbd> — камера, клик или <kbd>Пробел</kbd> — снимок', () => Cam.mode === 'photo', { max: 14 });
          });
        }
        // insect-silence lesson
        if (S.silence === 'none' && S.traces >= 1 && !S.seen) { S.silence = 'wait'; S.silenceT = 20; }
        if (S.silence === 'wait') {
          S.silenceT -= dt;
          if (S.silenceT < 0 && !HUD.radioBusy()) {
            S.silence = 'run'; S.silenceClock = 0;
            Sound.bed('insects', 0, 0.8);
            const fwd = new THREE.Vector2(-Math.sin(Cam.yaw), -Math.cos(Cam.yaw));
            const side = new THREE.Vector2(-fwd.y, fwd.x);
            S.rStart = new THREE.Vector2(p.pos.x + fwd.x * 85 + side.x * 30, p.pos.z + fwd.y * 85 + side.y * 30);
            S.rEnd = new THREE.Vector2(p.pos.x + fwd.x * 95 - side.x * 35, p.pos.z + fwd.y * 95 - side.y * 35);
            setTimeout(() => HUD.say([{ who: 'Лена', text: '<em>(шёпотом)</em> Итан… насекомые замолчали. Пригнитесь.' }], true), 1600);
          }
        }
        if (S.silence === 'run') {
          S.silenceClock += dt;
          const k = clamp((S.silenceClock - 2.5) / 9, 0, 1);
          shadowRaptor.visible = k > 0 && k < 1;
          const x = lerp(S.rStart.x, S.rEnd.x, k), z = lerp(S.rStart.y, S.rEnd.y, k);
          shadowRaptor.position.set(x, world.groundH(x, z), z);
          shadowRaptor.rotation.y = Math.atan2(S.rEnd.x - S.rStart.x, S.rEnd.y - S.rStart.y);
          shadowRaptor.userData.anim(dt, 3.2, { alert: true });
          if (S.silenceClock > 14) {
            S.silence = 'done'; shadowRaptor.visible = false; Sound.bed('insects', 0.05, 3);
            HUD.say([{ who: 'Лена', text: 'Ушёл. Что бы это ни было. Запомните этот звук — тишину.' }]);
          }
        }
        // herd discovered
        const nd = herd.nearestDist(p.pos);
        if (!S.seen && nd < 85) {
          S.seen = true; Journal.add('tri', 'seen');
          HUD.objective('Понаблюдайте за стадом', IS_TOUCH ? 'Присядьте и не двигайтесь в 25–75 м от стада, глядя на него. Можно сделать фото.' : 'Присядьте (C) и не двигайтесь в 25–75 м от стада, глядя на него. Можно сделать фото (F).');
          HUD.say([{ who: 'Лена', text: '<em>(шёпотом)</em> Вот они… Девять. Два детёныша в центре. Не подходите ближе — просто смотрите.' }]);
          Tutorial.show('crouch', IS_TOUCH ? 'Кнопка <kbd>Присесть</kbd> — стадо хуже замечает того, кто пригнулся' : '<kbd>C</kbd> — присесть. Стадо хуже замечает того, кто пригнулся', () => p.crouch, { max: 16 });
        }
        if (S.seen) S.herdSeenT += dt;
        // observation
        let observing = false;
        if (S.seen && S.observe < 20 && p.crouch && p.stillTime > 0.6 && nd > 22 && nd < 78 && herd.maxAlert() < 0.45 && Cam.mode !== 'cine') {
          const fx = -Math.sin(Cam.yaw), fz = -Math.cos(Cam.yaw);
          const tx = herd.center.x - p.pos.x, tz = herd.center.y - p.pos.z, tl = Math.hypot(tx, tz) || 1;
          if ((fx * tx + fz * tz) / tl > 0.78) observing = true;
        }
        if (observing) {
          const before = S.observe;
          S.observe += dt;
          if (before < 7 && S.observe >= 7) { Journal.add('tri', 'b_graze'); }
          if (before < 13 && S.observe >= 13) { Journal.add('tri', 'b_calves'); HUD.say([{ who: 'Лена', text: 'Детёныши всегда внутри. Взрослые стоят кольцом, мордами наружу.' }]); }
          if (before < 20 && S.observe >= 20) { Journal.add('tri', 'observe'); Journal.add('tri', 'b_elder'); HUD.say([{ who: 'Лена', text: 'Та, со сломанным рогом, — главная. В записях D-04 её звали Старухой.' }]); }
          HUD.observe(S.observe / 20);
        } else HUD.observe(null);
        // duel trigger
        if (S.duel === 'none' && S.seen && herd.state === 'graze' && herd.maxAlert() < 0.35 && nd < 95 && (Journal.pct('tri') >= 40 || S.herdSeenT > 150)) runDuel();
        // blood traces
        if (S.duel === 'done' && S.bloodPos && !Journal.has('tri', 't_blood') && dist2d(p.pos.x, p.pos.z, S.bloodPos.x, S.bloodPos.y) < 6) Journal.add('tri', 't_blood');
        HUD.danger(herd.charging && herd.charging.override && herd.charging.override.type === 'charge');
      },
      debug: () => ({ S, alert: herd.maxAlert(), herd: herd.state, center: { x: herd.center.x, z: herd.center.y } }),
      restore() {
        const cp = S.lastCp || { x: -12, z: 150 };
        Game.player.place(cp.x - 4, cp.z + 6, Math.PI);
        if (S.phase === 'hunt') lena().place(cp.x - 6, cp.z + 8);
        herd.reset(herd.center.x, herd.center.y);
        HUD.danger(false);
      },
    };
    return ctx;
  },
};
