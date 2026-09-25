// ============================================================
// 40-valley-world.js — Region 01: Landing Valley (also menu backdrop)
// ============================================================
const VALLEY = {
  center: { x: 10, z: -10 },
  lake: { x: -40, z: -10 },
  camp: { x: -20, z: 150 },
  pad: { x: -4, z: 168 },
  tower: { x: 34, z: 108 },
  trail: [[4, -32], [24, -44], [44, -57], [64, -70], [84, -83], [104, -97], [120, -110]],
  traces: { print: [6, -34], dung: [46, -58], cycad: [86, -84] },
  carcass: { x: 58, z: -34 },
  pastures: [[128, -118], [150, -62], [92, -150]],
  brachio: [[-66, -22], [-58, 6]],
  // the track D-04 walked from camp Echo to the lake shore
  track: [[-10, 150], [-10, 122], [-6, 94], [-2, 64], [2, 34], [4, 4], [5, -24]],
};
const LEAD_PATH = VALLEY.track.slice(1);
const _tmpC = new THREE.Color();
function valleyHeight(x, z) {
  const r = Math.hypot(x - VALLEY.center.x, z - VALLEY.center.z);
  let h = 3.5 + fbm(x * 0.011, z * 0.011, 4) * 4.5 + fbm(x * 0.045, z * 0.045, 2) * 0.9;
  const ring = smoothstep(205, 290, r);
  h += ring * (52 + fbm(x * 0.018 + 5, z * 0.018, 4) * 34);
  h -= smoothstep(330, 385, r) * 130;
  const dl = Math.hypot(x - VALLEY.lake.x, z - VALLEY.lake.z);
  h -= 8.6 * Math.exp(-(dl * dl) / (2 * 27 * 27));
  const dv = Math.hypot(x - 40, z + 290);
  h += 175 * Math.exp(-(dv * dv) / (2 * 62 * 62));
  const dc = Math.hypot(x - VALLEY.camp.x, z - VALLEY.camp.z - 8);
  h = lerp(h, 2.4, Math.exp(-(dc * dc) / (2 * 22 * 22)));
  return h;
}
function trackDist(x, z) {
  let best = 1e9;
  const t = VALLEY.track;
  for (let i = 0; i < t.length - 1; i++) {
    const [ax, az] = t[i], [bx, bz] = t[i + 1], dx = bx - ax, dz = bz - az;
    const k = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * k, z - az - dz * k));
  }
  return best;
}
function valleyColor(x, z, y, slope, c) {
  const n = fbm(x * 0.05, z * 0.05, 3) * 0.5 + 0.5;
  if (y < -1.4) c.set('#3d3b2f');
  else if (y < 0.3) c.set('#6d624a');
  else {
    c.set('#4a6431').lerp(_tmpC.set('#2f4424'), n);
    const m = fbm(x * 0.13, z * 0.13, 2); if (m > 0.3) c.lerp(_tmpC.set('#7a7a44'), 0.4);
    if (m < -0.35) c.lerp(_tmpC.set('#5a5236'), 0.3);
  }
  if (slope > 0.3) c.lerp(_tmpC.set('#66665a'), smoothstep(0.3, 0.55, slope));
  // worn track from camp Echo to the lake: bare earth that breaks up at the edges
  const td = trackDist(x, z) + fbm(x * 0.4, z * 0.4, 2) * 0.9;
  if (td < 2.2 && y > 0.3) c.lerp(_tmpC.set('#6e5d40'), (1 - smoothstep(0.9, 2.2, td)) * 0.75);
  if (y > 70) c.lerp(_tmpC.set('#4f5048'), smoothstep(70, 150, y));
  if (y > 150) c.lerp(_tmpC.set('#3a3530'), 0.6);
}

const TIME_PRESETS = {
  day: { sunDir: new THREE.Vector3(-0.55, 0.62, 0.55), top: '#5b8cc4', horizon: '#d3dcd6', low: '#7e9290', fog: '#b7c3bd', fogNear: 60, fogFar: 520, hemi: 0.95, sun: 3.2, sunColor: '#fff0d4', skyC: '#bcd6ea', groundC: '#3e4a2a' },
  dusk: { sunDir: new THREE.Vector3(-0.85, 0.2, 0.3), top: '#2b4670', horizon: '#eaa874', low: '#6b5a52', fog: '#a48f82', fogNear: 50, fogFar: 460, hemi: 0.75, sun: 2.4, sunColor: '#ffb47e', skyC: '#9fb2d0', groundC: '#3a3326' },
  dawn: { sunDir: new THREE.Vector3(0.1, 0.28, 0.95), top: '#4f77ad', horizon: '#f2c79a', low: '#7a7a70', fog: '#c7bca8', fogNear: 60, fogFar: 520, hemi: 0.95, sun: 2.6, sunColor: '#ffd3a0', skyC: '#b8c8e0', groundC: '#3e4430' },
  storm: { sunDir: new THREE.Vector3(-0.3, 0.7, 0.4), top: '#252c33', horizon: '#48525a', low: '#2a2f33', fog: '#3e474e', fogNear: 20, fogFar: 170, hemi: 0.5, sun: 0.5, sunColor: '#aab4c0', skyC: '#6a7682', groundC: '#1f2420' },
  night: { sunDir: new THREE.Vector3(0.3, 0.6, -0.4), top: '#070b14', horizon: '#18222e', low: '#0b0f14', fog: '#121a22', fogNear: 15, fogFar: 140, hemi: 0.28, sun: 0.35, sunColor: '#8aa0c8', skyC: '#3a4a66', groundC: '#10140f', sunSize: 0.5 },
};
function applyTime(world, key) {
  const t = TIME_PRESETS[key];
  world.scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
  makeSky(world, { top: t.top, horizon: t.horizon, low: t.low, sunDir: t.sunDir, sunColor: t.sunColor, sunSize: t.sunSize });
  makeLights(world, { sunDir: t.sunDir, sun: t.sun, hemi: t.hemi, sunColor: t.sunColor, skyColor: t.skyC, groundColor: t.groundC });
  world.timeKey = key;
  return t;
}

function scatter(n, fn) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 12) { const it = fn(); if (it) out.push(it); }
  return out;
}

function buildValleyWorld(o = {}) {
  seed(4242);
  const world = new World({ bounds: { x: VALLEY.center.x, z: VALLEY.center.z, r: 215 } });
  applyTime(world, o.time || 'day');
  makeTerrain(world, { size: 800, seg: 190, height: valleyHeight, color: valleyColor });
  makeWater(world, { y: -1.2, size: 4000, color: '#44706a' });
  makeVeil(world, { r: 640, x: VALLEY.center.x, z: VALLEY.center.z, h: 360 });
  const H = (x, z) => valleyHeight(x, z);
  const inMeadow = (x, z) => { const h = H(x, z); return h > 0.4 && Math.hypot(x - VALLEY.center.x, z - VALLEY.center.z) < 205; };
  const nearCamp = (x, z) => Math.hypot(x - VALLEY.camp.x, z - VALLEY.camp.z) < 20 || Math.hypot(x - VALLEY.pad.x, z - VALLEY.pad.z) < 12;

  // ferns
  const fernN = QUALITY ? 3200 : 1500;
  const ferns = scatter(fernN, () => {
    let x = rnd(-200, 220), z = rnd(-215, 200);
    if (rng() < 0.35) { const p = pick(VALLEY.pastures); x = p[0] + rnd(-45, 45); z = p[1] + rnd(-45, 45); }
    if (!inMeadow(x, z) || nearCamp(x, z)) return null;
    const s = rnd(0.7, 1.6);
    return { x, y: H(x, z) - 0.05, z, s, ry: rnd(0, TAU), tint: rng() < 0.5 ? '#6f9a45' : rng() < 0.5 ? '#5c8a3a' : '#88a452' };
  });
  makeFerns(world, ferns);
  // cycads & tree ferns
  const cyc = scatter(QUALITY ? 170 : 110, () => {
    const x = rnd(-190, 210), z = rnd(-200, 190);
    if (!inMeadow(x, z) || nearCamp(x, z)) return null;
    return { x, y: H(x, z) - 0.1, z, s: rnd(0.8, 1.4), ry: rnd(0, TAU) };
  });
  scatterInstanced(world, cycadGeo(), vegMat(0.02), cyc, { cast: true });
  const tf = scatter(QUALITY ? 90 : 50, () => {
    const a = rnd(0, TAU), rr = rnd(36, 60);
    const x = VALLEY.lake.x + Math.cos(a) * rr, z = VALLEY.lake.z + Math.sin(a) * rr;
    if (H(x, z) < 0.3) return null;
    return { x, y: H(x, z) - 0.1, z, s: rnd(0.9, 1.5), ry: rnd(0, TAU) };
  });
  scatterInstanced(world, treeFernGeo(), vegMat(0.01), tf, { cast: true });
  // conifers — dense ring and scattered stands
  const con = scatter(QUALITY ? 700 : 380, () => {
    const a = rnd(0, TAU), rr = rng() < 0.8 ? rnd(175, 330) : rnd(40, 200);
    const x = VALLEY.center.x + Math.cos(a) * rr, z = VALLEY.center.z + Math.sin(a) * rr;
    const h = H(x, z);
    if (h < 0.6 || h > 150 || nearCamp(x, z)) return null;
    if (rr < 175 && Math.hypot(x - 120, z + 110) < 60) return null;
    return { x, y: h - 0.2, z, s: rnd(1.1, 2.3), ry: rnd(0, TAU) };
  });
  scatterInstanced(world, coniferGeo(), vegMat(0.0025), con, { cast: true });
  // rocks / outcrops
  const rockM = new THREE.MeshLambertMaterial({ color: '#77756a', flatShading: true });
  const rocks = [[100, -94, 3.2], [142, -90, 2.6], [110, -140, 3.0], [70, -60, 1.8], [-10, 60, 2.4], [30, -110, 3.4], [160, -130, 2.8], [-90, 60, 3.0], [58, 30, 2.2]];
  for (let i = 0; i < 26; i++) rocks.push([rnd(-170, 190), rnd(-190, 170), rnd(0.8, 2.2)]);
  rocks.forEach(([x, z, s], i) => {
    if (H(x, z) < 0.2 || nearCamp(x, z)) return;
    const r = mesh(rockGeo(i), rockM, { pos: [x, H(x, z) + s * 0.25, z], rot: [rnd(0, 1), rnd(0, TAU), 0], scale: [s * 1.3, s, s * 1.1], receive: true });
    world.add(r);
    world.circles.push({ x, z, r: s * 1.1 });
  });

  // D-04 survey stakes with orange ribbon along the track: a line the eye follows to the lake
  {
    const parts = [];
    const t = VALLEY.track;
    let acc = 8;
    for (let i = 0; i < t.length - 1; i++) {
      const [ax, az] = t[i], [bx, bz] = t[i + 1], len = Math.hypot(bx - ax, bz - az);
      for (; acc < len; acc += 15) {
        const k = acc / len, side = (Math.floor(acc / 15) % 2 ? 1 : -1) * 2.4;
        const x = lerp(ax, bx, k) + (bz - az) / len * side, z = lerp(az, bz, k) - (bx - ax) / len * side;
        const y = H(x, z), lean = rnd(-0.08, 0.08);
        parts.push({ geo: G.cyl(0.035, 0.045, 1.5, 5), color: '#b8a888', m: M4(x, y + 0.72, z, lean, 0, lean) });
        parts.push({ geo: G.box(0.03, 0.14, 0.42), color: '#e0662a', m: M4(x, y + 1.35, z + 0.2, 0, rnd(0, TAU), 0.2) });
      }
      acc -= len;
    }
    const stakes = new THREE.Mesh(mergeParts(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
    stakes.castShadow = true; world.add(stakes);
  }
  // camp Echo (D-04 forward camp)
  const cx = VALLEY.camp.x, cz = VALLEY.camp.z;
  makeTent(world, cx - 7, cz - 4, 0.3);
  makeTent(world, cx + 6, cz - 6, -0.4, '#6a6048');
  makeTent(world, cx + 1, cz + 7, 1.4, '#4f5a44');
  makeCrate(world, cx - 2, cz - 1, 1, '#4f5a3c', 0.4);
  makeCrate(world, cx - 1, cz + 0.6, 0.8, '#5d573f', 0.9);
  makeCrate(world, cx + 3, cz + 1, 1.1, '#44503a', -0.2);
  const shed = mesh(G.box(3, 2.4, 2.4), mat('#5a5f55'), { pos: [cx + 10, H(cx + 10, cz + 3) + 1.2, cz + 3], receive: true });
  world.add(shed); world.circles.push({ x: cx + 10, z: cz + 3, r: 1.9 });
  const sign = new THREE.Group();
  mesh(G.box(0.12, 2.2, 0.12), mat('#3a3024'), { parent: sign, pos: [-1, 1.1, 0] });
  mesh(G.box(0.12, 2.2, 0.12), mat('#3a3024'), { parent: sign, pos: [1, 1.1, 0] });
  const signTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#c9c1a6'; g.fillRect(0, 0, w, h); g.fillStyle = '#26221a'; g.font = 'bold 40px Arial Narrow, Arial'; g.textAlign = 'center'; g.fillText('ECHO · D-04', w / 2, 46); });
  mesh(G.box(2.4, 0.6, 0.06), new THREE.MeshLambertMaterial({ map: signTex }), { parent: sign, pos: [0, 1.9, 0] });
  sign.position.set(cx - 4, H(cx - 4, cz + 14), cz + 14); sign.rotation.y = 0.2;
  world.add(sign);
  // tower T-2
  const tw = new THREE.Group();
  const tx = VALLEY.tower.x, tz = VALLEY.tower.z, th = H(tx, tz);
  for (const [a, b] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) mesh(G.box(0.2, 9, 0.2), mat('#4a4a44', { metal: 0.3 }), { parent: tw, pos: [a, 4.5, b] });
  mesh(G.box(3.4, 0.2, 3.4), mat('#56554c'), { parent: tw, pos: [0, 9, 0] });
  mesh(G.box(3.4, 1, 0.08), mat('#56554c'), { parent: tw, pos: [0, 9.6, 1.7] });
  mesh(G.cyl(0.05, 0.05, 3, 4), mat('#333'), { parent: tw, pos: [1, 11, -1] });
  tw.position.set(tx, th, tz);
  world.add(tw);
  world.circles.push({ x: tx, z: tz, r: 2.2 });
  // waterfall on the south-west cliff
  const wfTex = canvasTex(64, 256, (g, w, h) => { for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${rnd(0.2, 0.7)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(2, 6), rnd(20, 80)); } });
  wfTex.wrapT = THREE.RepeatWrapping;
  const wf = mesh(new THREE.PlaneGeometry(10, 70), new THREE.MeshBasicMaterial({ map: wfTex, transparent: true, opacity: 0.75, depthWrite: false, fog: true }), { pos: [-150, 42, 150], rot: [0, 0.9, 0], cast: false });
  world.add(wf);
  world.onUpdate((dt) => { wfTex.offset.y += dt * 0.9; });

  makeMotes(world, { color: '#fff3c4', count: QUALITY ? 450 : 220 });
  world.wind.set(0.8, -0.6).normalize();
  world.noiseMul = 1;

  // brachiosaurs at the lake (living backdrop)
  const brachios = VALLEY.brachio.map(([x, z], i) => {
    const b = makeBrachio();
    b.position.set(x, H(x, z) - 0.6, z);
    b.rotation.y = i ? 2.2 : 0.9;
    world.add(b);
    world.circles.push({ x, z, r: 4 });
    return b;
  });
  world.onUpdate((dt) => {
    brachios.forEach((b, i) => {
      b.userData.drinking = Math.sin(Game.time * 0.12 + i * 2) > 0.45;
      b.userData.anim(dt, 0);
    });
  });

  if (o.menu) {
    // a small herd grazing for the menu view
    for (let i = 0; i < 5; i++) {
      const t = makeTriceratops({ scale: i === 4 ? 0.5 : 1 });
      const x = -5 + i * 9, z = -70 + (i % 2) * 8;
      t.position.set(x, H(x, z), z); t.rotation.y = 1.8 + i * 0.2; world.add(t);
      world.onUpdate((dt) => t.userData.anim(dt, 0, { graze: Math.sin(Game.time * 0.3 + i) > -0.3 }));
    }
    Sound.bed('wind', 0.05);
  }
  return { world, brachios };
}
