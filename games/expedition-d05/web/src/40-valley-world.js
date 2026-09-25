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

// sky, light, fog and colour grade per time of day
const TIME_PRESETS = {
  day: { sunDir: new THREE.Vector3(-0.55, 0.62, 0.55), top: '#4f86c6', horizon: '#d6e0da', low: '#7e9290', fog: '#b9c6c0', fogNear: 70, fogFar: 560, hemi: 1.4, sun: 3.2, sunColor: '#fff0d4', skyC: '#bcd6ea', groundC: '#56603a',
    cover: 0.42, cloud: '#f4f6f8', cloudDark: 0.32, grade: { exposure: 1.02, contrast: 1.08, saturation: 1.14, lift: '#040608', gain: '#fff8ee', vignette: 0.85, bloom: 0.45 } },
  dusk: { sunDir: new THREE.Vector3(-0.85, 0.2, 0.3), top: '#2b4670', horizon: '#eaa874', low: '#6b5a52', fog: '#a48f82', fogNear: 50, fogFar: 460, hemi: 1.1, sun: 2.3, sunColor: '#ffb47e', skyC: '#9fb2d0', groundC: '#4a4232',
    cover: 0.5, cloud: '#f0b890', cloudDark: 0.55, grade: { exposure: 1.0, contrast: 1.1, saturation: 1.1, lift: '#0a0604', gain: '#ffe8d4', bloom: 0.62 } },
  dawn: { sunDir: new THREE.Vector3(0.1, 0.28, 0.95), top: '#4f77ad', horizon: '#f2c79a', low: '#7a7a70', fog: '#c7bca8', fogNear: 60, fogFar: 520, hemi: 1.35, sun: 2.5, sunColor: '#ffd3a0', skyC: '#b8c8e0', groundC: '#50563e',
    cover: 0.36, cloud: '#f6dcc0', cloudDark: 0.45, grade: { exposure: 1.03, contrast: 1.06, saturation: 1.08, lift: '#06070a', gain: '#fff0e0', bloom: 0.6 } },
  storm: { sunDir: new THREE.Vector3(-0.3, 0.7, 0.4), top: '#252c33', horizon: '#48525a', low: '#2a2f33', fog: '#3e474e', fogNear: 20, fogFar: 170, hemi: 0.5, sun: 0.5, sunColor: '#aab4c0', skyC: '#6a7682', groundC: '#1f2420',
    cover: 0.96, cloud: '#56606a', cloudDark: 0.6, grade: { exposure: 1.06, contrast: 1.14, saturation: 0.82, lift: '#04070a', gain: '#e8f0f6', bloom: 0.4, vignette: 1.1 } },
  night: { sunDir: new THREE.Vector3(0.3, 0.6, -0.4), top: '#070b14', horizon: '#18222e', low: '#0b0f14', fog: '#121a22', fogNear: 15, fogFar: 140, hemi: 0.5, sun: 0.55, sunColor: '#8aa0c8', skyC: '#3a4a66', groundC: '#10140f', sunSize: 0.5,
    cover: 0.55, cloud: '#2a3444', cloudDark: 0.7, grade: { exposure: 1.12, contrast: 1.12, saturation: 0.9, lift: '#020508', gain: '#dce8ff', bloom: 0.7, vignette: 1.15 } },
};
function applyTime(world, key) {
  const t = TIME_PRESETS[key];
  world.scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
  world.grade = t.grade;
  makeSky(world, { top: t.top, horizon: t.horizon, low: t.low, sunDir: t.sunDir, sunColor: t.sunColor, sunSize: t.sunSize, cover: t.cover, cloud: t.cloud, cloudDark: t.cloudDark });
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
  scatterInstanced(world, cycadGeo(), vegMat(0.02), cyc, { cast: true, far: 230 });
  const tf = scatter(QUALITY ? 90 : 50, () => {
    const a = rnd(0, TAU), rr = rnd(36, 60);
    const x = VALLEY.lake.x + Math.cos(a) * rr, z = VALLEY.lake.z + Math.sin(a) * rr;
    if (H(x, z) < 0.3) return null;
    return { x, y: H(x, z) - 0.1, z, s: rnd(0.9, 1.5), ry: rnd(0, TAU) };
  });
  scatterInstanced(world, treeFernGeo(), vegMat(0.01), tf, { cast: true, far: 260 });
  // conifers — dense ring and scattered stands
  const con = scatter(QUALITY ? 700 : 380, () => {
    const a = rnd(0, TAU), rr = rng() < 0.8 ? rnd(175, 330) : rnd(40, 200);
    const x = VALLEY.center.x + Math.cos(a) * rr, z = VALLEY.center.z + Math.sin(a) * rr;
    const h = H(x, z);
    if (h < 0.6 || h > 150 || nearCamp(x, z)) return null;
    if (rr < 175 && Math.hypot(x - 120, z + 110) < 60) return null;
    return { x, y: h - 0.2, z, s: rnd(1.1, 2.3), ry: rnd(0, TAU) };
  });
  scatterInstanced(world, coniferGeo(), vegMat(0.0025), con, { cast: true, chunk: 170 });
  // broadleaf trees and bushes break up the conifer ring; palms stand on the lake shore
  const L3 = (a, b, c) => [a, b, c][GFX.level];
  const nearTrack = (x, z) => trackDist(x, z) < 5;
  for (let v = 0; v < 3; v++) {
    const bl = scatter(L3(18, 32, 50), () => {
      const a = rnd(0, TAU), rr = rng() < 0.6 ? rnd(120, 200) : rnd(30, 150);
      const x = VALLEY.center.x + Math.cos(a) * rr, z = VALLEY.center.z + Math.sin(a) * rr;
      const h = H(x, z);
      if (h < 0.6 || h > 40 || nearCamp(x, z) || nearTrack(x, z)) return null;
      if (Math.hypot(x - 120, z + 110) < 55) return null;
      return { x, y: h - 0.2, z, s: rnd(0.85, 1.35), ry: rnd(0, TAU) };
    });
    scatterInstanced(world, broadleafGeo(v + 1), leafMat(0.006), bl, { cast: true, low: broadleafGeo(v + 1, 0), lowD: 70 });
    const bu = scatter(L3(45, 90, 140), () => { const x = rnd(-190, 210), z = rnd(-200, 190); if (!inMeadow(x, z) || nearCamp(x, z) || nearTrack(x, z)) return null; return { x, y: H(x, z) - 0.1, z, s: rnd(0.7, 1.5), ry: rnd(0, TAU) }; });
    // bushes sit in the grass; their shadows did not read but cost as much as the trees'
    scatterInstanced(world, bushGeo(v + 1), leafMat(0.01), bu, { cast: false, far: 190, low: bushGeo(v + 1, 0), lowD: 40 });
  }
  makePalms(world, scatter(L3(14, 24, 36), () => {
    const a = rnd(0, TAU), rr = rnd(30, 44);
    const x = VALLEY.lake.x + Math.cos(a) * rr, z = VALLEY.lake.z + Math.sin(a) * rr;
    const h = H(x, z);
    if (h < 0.3 || h > 6) return null;
    return { x, y: h - 0.1, z, s: rnd(0.85, 1.25), ry: rnd(0, TAU) };
  }));
  if (!o.menu) makeGrassField(world, {
    count: L3(1600, 4800, 9000), radius: L3(28, 38, 46), cx: VALLEY.camp.x, cz: VALLEY.camp.z,
    accept: (x, z) => { const h = H(x, z); return h > 0.45 && Math.hypot(x - VALLEY.center.x, z - VALLEY.center.z) < 205 && trackDist(x, z) > 1.2 && !(Math.hypot(x - VALLEY.camp.x, z - VALLEY.camp.z) < 11); },
    tints: ['#6a8a4a', '#5f7f42', '#748f50', '#7f8a4e', '#587a3c'],
  });
  // rocks / outcrops: lichen and moss on the upward faces
  const rockM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true, envMapIntensity: 0.4 });
  const mossRock = (g, i) => {
    const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3), a = new THREE.Color(), b = new THREE.Color('#5d7a3a');
    for (let k = 0; k < p.count; k++) { a.set('#7a786c').multiplyScalar(0.8 + hash2(k + i * 31, i) * 0.35); a.lerp(b, smoothstep(0.45, 0.85, n.getY(k)) * 0.75); c[k * 3] = a.r; c[k * 3 + 1] = a.g; c[k * 3 + 2] = a.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const rocks = [[100, -94, 3.2], [142, -90, 2.6], [110, -140, 3.0], [70, -60, 1.8], [-10, 60, 2.4], [30, -110, 3.4], [160, -130, 2.8], [-90, 60, 3.0], [58, 30, 2.2]];
  for (let i = 0; i < 26; i++) rocks.push([rnd(-170, 190), rnd(-190, 170), rnd(0.8, 2.2)]);
  const rockG = new THREE.Group(); // one draw call for all outcrops
  rocks.forEach(([x, z, s], i) => {
    if (H(x, z) < 0.2 || nearCamp(x, z)) return;
    mesh(mossRock(rockGeo(i), i), rockM, { parent: rockG, pos: [x, H(x, z) + s * 0.25, z], rot: [rnd(0, 0.3), rnd(0, TAU), 0], scale: [s * 1.3, s, s * 1.1], receive: true });
    world.circles.push({ x, z, r: s * 1.1 });
  });
  world.add(bakeRig(rockG));

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
  // camp dressing: one merged mesh — a lived-in camp the previous team left in a hurry
  {
    const parts = [], at = (x, z) => [x, H(x, z), z];
    const P = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0) => parts.push({ geo, color, m: M4(x, y, z, rx, ry, rz) });
    // tarp shelter
    { const [x, y, z] = at(cx + 2, cz - 9); for (const [a, b, h] of [[-1.8, -1.2, 2.2], [1.8, -1.2, 2.2], [-1.8, 1.2, 1.5], [1.8, 1.2, 1.5]]) P(G.cyl(0.05, 0.05, h, 6), '#6a5a40', x + a, y + h / 2, z + b); P(G.box(3.7, 0.04, 2.6), '#6f7c52', x, y + 1.86, z, 0.26, 0, 0); world.circles.push({ x, z, r: 1.4 }); }
    // folding table with radio, lantern and maps
    { const [x, y, z] = at(cx - 1.5, cz + 3.5); P(G.box(1.6, 0.05, 0.8), '#7a7060', x, y + 0.78, z); for (const [a, b] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) P(G.cyl(0.02, 0.02, 0.78, 5), '#333', x + a, y + 0.39, z + b);
      P(G.box(0.42, 0.22, 0.28), '#3a3f38', x - 0.35, y + 0.92, z); P(G.cyl(0.006, 0.006, 0.9, 4), '#222', x - 0.5, y + 1.45, z); P(G.box(0.5, 0.01, 0.35), '#d8cfae', x + 0.35, y + 0.81, z, 0, 0.3, 0); P(G.cyl(0.07, 0.08, 0.2, 8), '#8a6a2a', x + 0.55, y + 0.9, z - 0.2);
      world.circles.push({ x, z, r: 0.9 }); }
    // fuel and water drums, jerrycans
    for (let i = 0; i < 5; i++) { const [x, y, z] = at(cx + 8 + (i % 3) * 0.75, cz - 1 + Math.floor(i / 3) * 0.75); P(G.cyl(0.3, 0.3, 0.9, 12), i % 2 ? '#3b4a5a' : '#5a4a2a', x, y + 0.45, z); }
    { const [x, y, z] = at(cx + 8.6, cz + 1.4); P(G.cyl(0.3, 0.3, 0.9, 12), '#6a3a24', x, y + 0.3, z, 0, 0.4, Math.PI / 2); }
    world.circles.push({ x: cx + 8.8, z: cz - 0.5, r: 1.4 });
    for (let i = 0; i < 3; i++) { const [x, y, z] = at(cx - 3.2 + i * 0.4, cz - 2.3); P(G.box(0.3, 0.42, 0.16), '#7a6a2a', x, y + 0.21, z, 0, 0.1 * i, 0); }
    // generator and floodlight on a tripod
    { const [x, y, z] = at(cx + 9, cz + 7); P(G.box(1.2, 0.7, 0.7), '#b8952a', x, y + 0.35, z); P(G.box(1.25, 0.08, 0.75), '#2a2a2a', x, y + 0.72, z); P(G.cyl(0.05, 0.05, 0.4, 6), '#222', x + 0.45, y + 0.9, z); world.circles.push({ x, z, r: 0.8 }); world.campGen = { x, y: y + 0.4, z }; }
    { const [x, y, z] = at(cx - 7, cz + 9); for (let k = 0; k < 3; k++) { const a = k * TAU / 3; P(G.cyl(0.02, 0.02, 2.4, 5), '#333', x + Math.cos(a) * 0.35, y + 1.1, z + Math.sin(a) * 0.35, Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15); } P(G.box(0.5, 0.35, 0.22), '#2a2a28', x, y + 2.35, z, -0.3, 0.6, 0); }
    // clothesline between two poles, and a fire ring of stones
    { const [ax, ay, az] = at(cx + 4, cz + 12), [bx, by, bz] = at(cx + 9, cz + 11); P(G.cyl(0.04, 0.05, 2.1, 6), '#5a4a34', ax, ay + 1.05, az); P(G.cyl(0.04, 0.05, 2.1, 6), '#5a4a34', bx, by + 1.05, bz);
      const len = Math.hypot(bx - ax, bz - az); P(G.cyl(0.006, 0.006, len, 3), '#ddd', (ax + bx) / 2, (ay + by) / 2 + 1.9, (az + bz) / 2, 0, -Math.atan2(bz - az, bx - ax), Math.PI / 2);
      [['#8a4a2a', 0.3], ['#c8c0a8', 0.55], ['#3e5a6a', 0.78]].forEach(([c, k]) => P(G.box(0.5, 0.55, 0.02), c, lerp(ax, bx, k), lerp(ay, by, k) + 1.6, lerp(az, bz, k), 0, -Math.atan2(bz - az, bx - ax), 0)); }
    { const [x, y, z] = at(cx, cz + 3); for (let k = 0; k < 9; k++) { const a = k * TAU / 9; P(G.sphere(0.22, 7, 5), '#6a6a62', x + Math.cos(a) * 0.9, y + 0.1, z + Math.sin(a) * 0.9); } P(G.cyl(0.08, 0.08, 1.2, 6), '#2a1e14', x, y + 0.12, z, 0, 0.6, Math.PI / 2); P(G.cyl(0.08, 0.08, 1.1, 6), '#2a1e14', x, y + 0.14, z, 0, -0.7, Math.PI / 2); }
    // along the track: a camera trap on a stake, a drum, a sign at the lake
    { const [x, y, z] = at(-8.6, 96); P(G.cyl(0.05, 0.06, 1.5, 6), '#6a5a40', x, y + 0.75, z); P(G.box(0.18, 0.24, 0.12), '#3a4a2e', x, y + 1.25, z + 0.08); }
    { const [x, y, z] = at(1.5, 62); P(G.cyl(0.3, 0.3, 0.9, 12), '#6a3624', x, y + 0.2, z, 0.2, 0.5, Math.PI / 2 - 0.1); world.circles.push({ x, z, r: 0.6 }); }
    { const [x, y, z] = at(7, 6); P(G.cyl(0.05, 0.06, 1.8, 6), '#6a5a40', x, y + 0.9, z); P(G.box(1.1, 0.3, 0.04), '#c9c1a6', x + 0.35, y + 1.6, z, 0, -0.5, 0); }
    const m = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, envMapIntensity: 0.4 }));
    m.castShadow = true; m.receiveShadow = true; world.add(m);
    const lakeSign = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#c9c1a6'; g.fillRect(0, 0, w, h); g.fillStyle = '#26221a'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.fillText('ОЗЕРО · LAKE →', w / 2, 44); });
    mesh(new THREE.PlaneGeometry(1.05, 0.28), new THREE.MeshLambertMaterial({ map: lakeSign }), { parent: world.scene, pos: [7.35 + Math.cos(0.5) * 0.02, H(7, 6) + 1.6, 6 - 0.03], rot: [0, -0.5, 0], cast: false });
    const trapLed = mesh(G.sphere(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3020' }), { parent: world.scene, pos: [-8.6, H(-8.6, 96) + 1.3, 96.15], cast: false });
    world.onUpdate(() => { trapLed.visible = (Game.time % 2) < 0.12; });
    // puddles by the camp
    const pud = new THREE.MeshStandardMaterial({ color: '#2a2a22', roughness: 0.04, metalness: 0.2, envMapIntensity: 1.2 });
    [[cx - 5, cz + 1, 1.2], [cx + 4, cz + 5, 0.8], [cx - 1, cz - 6, 1.0], [-6, 128, 1.4], [-3, 80, 0.9]].forEach(([x, z, r]) => mesh(new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2), pud, { parent: world.scene, pos: [x, H(x, z) + 0.03, z], scale: [1, 1, 0.7], cast: false }));
  }
  // ground clutter: fallen logs, stumps and stones — breaks the empty-lawn look
  {
    const logGeo = mergeColored([{ geo: G.cyl(0.22, 0.28, 4.2, 9), color: '#5a4632', m: M4(0, 0, 0, 0, 0, Math.PI / 2) }, { geo: G.cyl(0.06, 0.09, 1.2, 5), color: '#5a4632', m: M4(0.6, 0.35, 0, 0.6, 0, 0.3) }]);
    const inMeadowEdge = (x, z) => { const h = H(x, z); return h > 0.5 && h < 30 && !nearCamp(x, z) && !nearTrack(x, z); };
    scatterInstanced(world, logGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), scatter(L3(14, 26, 40), () => { const x = rnd(-190, 210), z = rnd(-200, 190); if (!inMeadowEdge(x, z)) return null; const s = rnd(0.5, 0.95); return { x, y: H(x, z) + 0.2 * s, z, s, ry: rnd(0, TAU) }; }), { cast: true });
    const stumpGeo = mergeColored([{ geo: G.cyl(0.32, 0.42, 0.6, 9), color: '#5e4a34', m: M4(0, 0.3, 0) }, { geo: G.cyl(0.3, 0.3, 0.02, 9), color: '#b09a70', m: M4(0, 0.61, 0) }]);
    scatterInstanced(world, stumpGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), scatter(L3(12, 22, 34), () => { const x = rnd(-190, 210), z = rnd(-200, 190); if (!inMeadowEdge(x, z)) return null; return { x, y: H(x, z) - 0.05, z, s: rnd(0.7, 1.4), ry: rnd(0, TAU) }; }), { cast: true });
    const stone = mossRock(rockGeo(7, 0), 7);
    scatterInstanced(world, stone, rockM, scatter(L3(120, 260, 420), () => { const x = rnd(-190, 210), z = rnd(-200, 190); const h = H(x, z); if (h < 0.1 || h > 60 || nearCamp(x, z)) return null; return { x, y: h + 0.02, z, s: rnd(0.12, 0.38), ry: rnd(0, TAU), tilt: rnd(0, 0.5) }; }), { cast: false, far: 90 });
  }
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
