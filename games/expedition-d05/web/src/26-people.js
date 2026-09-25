// ============================================================
// 26-people.js — procedural human figure
//
// A small bone hierarchy (hips → spine → neck, shoulders → elbows,
// thighs → knees). Every bone's pieces are merged into one vertex-coloured
// mesh, so a person costs ~12 draw calls. The look is data (see
// CHARACTERS in 27-cast.js): outfit layers, hair, headwear and gear give
// each character a different silhouette, not just a different tint.
//
// Interface shared with any replacement model (e.g. a rigged glTF):
//   g.userData.anim(dt, speed, state)  state: crouch, sit, talk, point,
//     wave, hold, lookY, lookX
//   g.userData.caseLights (optional), g.userData.height
// ============================================================
let _humanMat = null;
function humanMaterial() {
  return (_humanMat ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.0 }));
}

// merge geometries keeping their smooth normals; parts: [{geo, color, m}]
function mergeColored(parts) {
  let nv = 0, ni = 0;
  const gs = parts.map((p) => {
    const g = p.geo;
    g.applyMatrix4(p.m);
    if (!g.index) { const idx = new Array(g.attributes.position.count); for (let i = 0; i < idx.length; i++) idx[i] = i; g.setIndex(idx); }
    nv += g.attributes.position.count; ni += g.index.count;
    return { g, c: new THREE.Color(p.color) };
  });
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3);
  const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const { g, c } of gs) {
    const pa = g.attributes.position, na = g.attributes.normal, idx = g.index;
    for (let i = 0; i < pa.count; i++) {
      const k = (vo + i) * 3;
      P[k] = pa.getX(i); P[k + 1] = pa.getY(i); P[k + 2] = pa.getZ(i);
      N[k] = na.getX(i); N[k + 1] = na.getY(i); N[k + 2] = na.getZ(i);
      C[k] = c.r; C[k + 1] = c.g; C[k + 2] = c.b;
    }
    for (let k = 0; k < idx.count; k++) I[io + k] = idx.getX(k) + vo;
    vo += pa.count; io += idx.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setIndex(new THREE.BufferAttribute(I, 1));
  out.computeBoundingSphere();
  return out;
}
const _shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

function makeHuman(o = {}) {
  const g = new THREE.Group();
  const fem = !!o.female;
  const sw = (o.bulk ?? 1) * (fem ? 0.9 : 1); // shoulder width
  const hw = fem ? 1.06 : 1; // hip width
  const skin = o.skin || '#c49a76', hair = o.hair || '#2a211a';
  const top = o.top || o.outfit || '#4b5238', pants = o.pants || '#3b3f2e', boots = o.boots || '#2a2219';
  const sleeve = o.sleeve || top, hands = o.gloves || skin;
  const bones = {}, parts = {};
  const bone = (name, parent, x, y, z) => { const b = new THREE.Group(); b.position.set(x, y, z); (parent ? bones[parent] : g).add(b); bones[name] = b; parts[name] = []; return b; };
  const P = (name, geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => parts[name].push({ geo, color, m: M4(x, y, z, rx, ry, rz, sx, sy, sz) });
  const S = (r = 1, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
  const Cy = (rt, rb, h, s = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
  const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  bone('hips', null, 0, 0.94, 0);
  bone('spine', 'hips', 0, 0.02, 0);
  bone('neck', 'spine', 0, 0.6, 0);
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R'; // the figure faces +Z, so its left is +X
    bone('sh' + L, 'spine', s * 0.19 * sw, 0.5, 0);
    bone('el' + L, 'sh' + L, 0, -0.29, 0);
    bone('th' + L, 'hips', s * 0.095 * hw, -0.02, 0);
    bone('kn' + L, 'th' + L, 0, -0.44, 0);
  }

  // ---- torso ----
  P('hips', S(1, 16, 10), pants, 0, 0.0, 0, 0, 0, 0, 0.165 * hw, 0.12, 0.115);
  P('spine', Cy(0.15 * sw, 0.155 * hw, 0.22, 16), top, 0, 0.14, 0);
  P('spine', S(1, 16, 12), top, 0, 0.36, fem ? 0.005 : 0, 0, 0, 0, 0.19 * sw, 0.2, 0.125);
  if (fem) for (const s of [1, -1]) P('spine', S(0.06, 12, 8), top, s * 0.062, 0.335, 0.085);
  P('spine', S(1, 16, 10), top, 0, 0.49, 0, 0, 0, 0, 0.215 * sw, 0.075, 0.11);
  P('spine', Cy(0.047, 0.052, 0.14, 12), skin, 0, 0.58, 0.005);
  if (o.belt) P('spine', Cy(0.158 * hw, 0.16 * hw, 0.04, 16), o.belt, 0, 0.04, 0);
  if (o.collar) P('spine', new THREE.TorusGeometry(0.058, 0.022, 8, 16), o.collar, 0, 0.555, 0.005, Math.PI / 2 - 0.25, 0, 0);
  if (o.scarf) P('spine', new THREE.TorusGeometry(0.062, 0.03, 8, 16), o.scarf, 0, 0.56, 0.008, Math.PI / 2 - 0.2, 0, 0);
  // long coat / lab coat: a skirt hanging from the hips, open at the front
  if (o.coat) {
    const len = o.coatLen ?? 0.58;
    P('hips', Cy(0.18 * hw, 0.225 * hw, len, 18, true), o.coat, 0, -len / 2 + 0.06, -0.005);
    P('spine', Bx(0.02, 0.5, 0.01), _shade(o.coat, 0.72), 0, 0.28, 0.128); // front edge / placket
    if (o.lapel) for (const s of [1, -1]) P('spine', Bx(0.06, 0.2, 0.012), o.lapel, s * 0.05, 0.42, 0.121, 0.08, 0, s * 0.35);
    for (const s of [1, -1]) P('hips', Bx(0.1, 0.1, 0.012), _shade(o.coat, 0.9), s * 0.12, -0.16, 0.21, 0.15, 0, 0);
  }
  // vests
  if (o.vest === 'tactical') {
    const vc = o.vestColor || '#4a4a3a';
    P('spine', Bx(0.36 * sw, 0.34, 0.07), vc, 0, 0.32, 0.105);
    P('spine', Bx(0.36 * sw, 0.34, 0.07), vc, 0, 0.32, -0.105);
    for (const s of [1, -1]) P('spine', Bx(0.06, 0.28, 0.2), _shade(vc, 0.85), s * 0.17 * sw, 0.3, 0);
    for (let i = 0; i < 3; i++) P('spine', Bx(0.075, 0.1, 0.05), _shade(vc, 1.12), -0.085 + i * 0.085, 0.22, 0.155);
    P('spine', Bx(0.09, 0.06, 0.04), _shade(vc, 1.12), 0.08, 0.37, 0.15);
    P('spine', Bx(0.035, 0.09, 0.03), '#1c1c1a', -0.1, 0.4, 0.15); // radio
    P('spine', Cy(0.005, 0.005, 0.16, 5), '#141414', -0.1, 0.5, 0.15);
  } else if (o.vest === 'field') {
    const vc = o.vestColor || '#3f6f6e';
    for (const s of [1, -1]) P('spine', Bx(0.13, 0.32, 0.035), vc, s * 0.09, 0.32, 0.112, 0, 0, 0);
    P('spine', Bx(0.34 * sw, 0.34, 0.035), vc, 0, 0.32, -0.112);
    for (const s of [1, -1]) P('spine', Bx(0.07, 0.07, 0.03), _shade(vc, 1.15), s * 0.09, 0.25, 0.135);
  }
  if (o.flightsuit) { // zipper and chest pockets on a one-piece suit
    P('spine', Bx(0.012, 0.46, 0.01), _shade(top, 0.7), 0, 0.3, 0.124);
    for (const s of [1, -1]) P('spine', Bx(0.07, 0.08, 0.012), _shade(top, 0.9), s * 0.085, 0.38, 0.12);
    if (o.patch) P('spine', Bx(0.05, 0.03, 0.012), o.patch, 0.085, 0.43, 0.125);
  }
  // back gear
  let caseLights = null;
  if (o.pack) {
    const pc = o.packColor || '#3f3a2c';
    P('spine', Bx(0.32, 0.42, 0.17), pc, 0, 0.32, -0.2);
    P('spine', Bx(0.34, 0.1, 0.2), _shade(pc, 0.8), 0, 0.53, -0.2);
    P('spine', Cy(0.07, 0.07, 0.36, 10), _shade(pc, 1.25), 0, 0.08, -0.2, 0, 0, Math.PI / 2);
    for (const s of [1, -1]) P('spine', Bx(0.035, 0.34, 0.012), _shade(pc, 0.7), s * 0.1, 0.36, 0.123);
    if (o.caseLights) {
      P('spine', Bx(0.36, 0.13, 0.08), '#1a1e20', 0, 0.2, -0.305);
      caseLights = [];
      for (let i = 0; i < 6; i++) {
        const lm = new THREE.MeshStandardMaterial({ color: '#333', emissive: new THREE.Color('#e3a33b'), emissiveIntensity: 0.25 });
        caseLights.push(mesh(G.sphere(0.017, 8, 6), lm, { parent: bones.spine, pos: [-0.125 + i * 0.05, 0.2, -0.348], cast: false }));
      }
    }
  }
  if (o.rifle) {
    P('spine', Bx(0.045, 0.86, 0.06), '#1d1f1c', 0.0, 0.3, -0.16, 0, 0, 0.78);
    P('spine', Bx(0.04, 0.1, 0.05), '#26281f', 0.07, 0.24, -0.19, 0, 0, 0.78);
    P('spine', Bx(0.03, 0.5, 0.01), '#2a2a24', 0, 0.33, 0.13, 0, 0, -0.78); // sling across the chest
  }
  if (o.bag) {
    P('spine', Bx(0.028, 0.6, 0.012), _shade(o.bag, 0.75), 0, 0.3, 0.128, 0, 0, 0.72);
    P('spine', Bx(0.028, 0.6, 0.012), _shade(o.bag, 0.75), 0, 0.3, -0.128, 0, 0, -0.72);
    P('spine', Bx(0.2, 0.16, 0.07), o.bag, 0.19, 0.02, 0.04, 0, 0.3, 0);
  }
  if (o.holster) P('th' + (o.holster === 'L' ? 'L' : 'R'), Bx(0.05, 0.14, 0.09), '#1e1e1c', (o.holster === 'L' ? 1 : -1) * 0.08, -0.1, 0);

  // ---- head ----
  P('neck', S(1, 18, 14), skin, 0, 0.115, 0, 0, 0, 0, 0.094 * (fem ? 0.96 : 1), 0.113, 0.103);
  P('neck', S(1, 14, 10), skin, 0, 0.05, 0.028, 0, 0, 0, 0.068 * (fem ? 0.9 : 1), 0.05, 0.066);
  P('neck', S(1, 10, 8), _shade(skin, 0.94), 0, 0.103, 0.098, 0.2, 0, 0, 0.016, 0.026, 0.02);
  for (const s of [1, -1]) {
    P('neck', S(0.014, 10, 8), '#ece6da', s * 0.035, 0.126, 0.083);
    P('neck', S(0.008, 8, 6), o.eyes || '#2a1d14', s * 0.035, 0.126, 0.095);
    P('neck', Bx(0.034, 0.008, 0.012), o.brows || hair, s * 0.036, 0.148, 0.094, 0, 0, s * -0.12);
    P('neck', S(1, 10, 8), skin, s * 0.093, 0.112, -0.004, 0, 0, 0, 0.012, 0.024, 0.018);
  }
  P('neck', Bx(0.034, 0.007, 0.012), _shade(skin, 0.72), 0, 0.068, 0.089);
  const hs = o.hairStyle || 'short';
  if (hs === 'short' || hs === 'grey' || hs === 'buzz') {
    const k = hs === 'buzz' ? 0.985 : 1;
    P('neck', S(1, 16, 10), hair, 0, 0.158, -0.012, 0, 0, 0, 0.1 * k, 0.078 * k, 0.108 * k);
    P('neck', S(1, 14, 10), hair, 0, 0.108, -0.045, 0, 0, 0, 0.092 * k, 0.085 * k, 0.07 * k);
    if (hs === 'short') P('neck', Bx(0.1, 0.02, 0.04), hair, 0.012, 0.19, 0.075, 0.5, 0, -0.15); // fringe
  } else if (hs === 'ponytail') {
    P('neck', S(1, 16, 10), hair, 0, 0.16, -0.01, 0, 0, 0, 0.102, 0.082, 0.11);
    P('neck', S(1, 14, 10), hair, 0, 0.108, -0.045, 0, 0, 0, 0.095, 0.09, 0.072);
    P('neck', S(0.03, 10, 8), _shade(hair, 0.8), 0, 0.15, -0.112);
    P('neck', Cy(0.032, 0.012, 0.22, 10), hair, 0, 0.05, -0.14, 0.32, 0, 0);
  }
  if (o.stubble) P('neck', S(1, 14, 10), o.stubble, 0, 0.048, 0.03, 0, 0, 0, 0.07, 0.052, 0.067);
  if (o.moustache) P('neck', Bx(0.05, 0.012, 0.014), o.moustache, 0, 0.082, 0.097);
  if (o.beard) P('neck', S(1, 14, 10), o.beard, 0, 0.042, 0.035, 0, 0, 0, 0.074, 0.058, 0.07);
  if (o.glasses) {
    const gc = o.glasses === true ? '#2a2420' : o.glasses;
    P('neck', Bx(0.13, 0.006, 0.006), gc, 0, 0.136, 0.1);
    for (const s of [1, -1]) { P('neck', Bx(0.042, 0.03, 0.004), o.lens || '#a8c0c8', s * 0.035, 0.126, 0.101); P('neck', Bx(0.004, 0.005, 0.1), gc, s * 0.066, 0.134, 0.05); }
  }
  if (o.sunglasses) for (const s of [1, -1]) P('neck', Bx(0.044, 0.026, 0.006), '#141414', s * 0.035, 0.127, 0.102);
  if (o.cap) {
    P('neck', S(1, 16, 8), o.cap, 0, 0.17, 0, 0, 0, 0, 0.106, 0.06, 0.112);
    P('neck', Bx(0.13, 0.012, 0.085), _shade(o.cap, 0.85), 0, 0.172, 0.105, -0.12, 0, 0);
  }
  if (o.beanie) P('neck', S(1, 16, 10), o.beanie, 0, 0.17, -0.005, 0, 0, 0, 0.106, 0.075, 0.112);
  if (o.hat) { P('neck', Cy(0.16, 0.16, 0.012, 20), o.hat, 0, 0.19, 0); P('neck', Cy(0.085, 0.1, 0.08, 16), o.hat, 0, 0.22, 0); }
  if (o.helmet) {
    P('neck', S(1, 18, 12), o.helmet, 0, 0.15, -0.006, 0, 0, 0, 0.122, 0.1, 0.13);
    P('neck', Cy(0.125, 0.128, 0.03, 18), _shade(o.helmet, 0.8), 0, 0.12, -0.006);
    if (o.goggles) { P('neck', Bx(0.19, 0.03, 0.05), '#1a1a18', 0, 0.2, 0.085, -0.4, 0, 0); for (const s of [1, -1]) P('neck', Bx(0.055, 0.035, 0.02), '#2e4450', s * 0.04, 0.205, 0.11, -0.4, 0, 0); }
  }
  if (o.pilotHelmet) {
    P('neck', S(1, 18, 12), o.pilotHelmet, 0, 0.14, -0.004, 0, 0, 0, 0.128, 0.12, 0.13);
    P('neck', new THREE.SphereGeometry(1, 16, 6, 0, Math.PI, Math.PI * 0.34, Math.PI * 0.28), '#241a12', 0, 0.13, 0.006, 0, 0, 0, 0.132, 0.125, 0.136); // tinted visor band
    P('neck', Cy(0.004, 0.004, 0.12, 5), '#141414', 0.07, 0.065, 0.08, 0, 0.6, Math.PI / 2 + 0.3);
  }
  if (o.headset) { for (const s of [1, -1]) P('neck', S(0.034, 10, 8), '#1e1e1e', s * 0.075, -0.02, 0.0); P('neck', new THREE.TorusGeometry(0.08, 0.008, 6, 16, Math.PI), '#1e1e1e', 0, -0.02, 0, 0, 0, Math.PI); }

  // ---- limbs ----
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    P('sh' + L, S(0.056, 12, 8), sleeve, 0, 0, 0);
    P('sh' + L, Cy(0.052, 0.045, 0.29, 12), sleeve, 0, -0.145, 0);
    if (o.patch && o.flightsuit) P('sh' + L, Bx(0.012, 0.05, 0.05), o.patch, s * 0.052, -0.08, 0);
    const rolled = o.sleeves === 'rolled';
    P('el' + L, S(0.045, 12, 8), rolled ? skin : sleeve, 0, 0, 0);
    if (rolled) P('el' + L, Cy(0.052, 0.05, 0.05, 12), _shade(sleeve, 1.08), 0, 0.012, 0);
    P('el' + L, Cy(0.043, 0.034, 0.25, 12), rolled ? skin : sleeve, 0, -0.125, 0);
    if (!rolled) P('el' + L, Cy(0.038, 0.038, 0.035, 12), _shade(sleeve, 0.85), 0, -0.235, 0);
    P('el' + L, S(1, 12, 10), hands, 0, -0.3, 0.004, 0, 0, 0, 0.033, 0.07, 0.042);
    P('el' + L, S(1, 8, 6), hands, s * 0.028, -0.275, 0.028, 0.3, 0, 0, 0.014, 0.032, 0.014);
    P('th' + L, Cy(0.078 * hw, 0.058, 0.44, 12), pants, 0, -0.22, 0);
    if (o.cargo) P('th' + L, Bx(0.03, 0.12, 0.1), _shade(pants, 0.9), s * 0.072, -0.24, 0);
    P('kn' + L, S(0.057, 12, 8), pants, 0, 0, 0);
    if (o.kneepads) P('kn' + L, S(1, 10, 8), '#252622', 0, 0, 0.035, 0, 0, 0, 0.055, 0.06, 0.035);
    P('kn' + L, Cy(0.055, 0.043, 0.36, 12), pants, 0, -0.18, 0);
    P('kn' + L, Cy(0.05, 0.052, 0.12, 12), boots, 0, -0.36, 0.004);
    P('kn' + L, S(1, 12, 8), boots, 0, -0.418, 0.045, 0, 0, 0, 0.052, 0.045, 0.12);
    P('kn' + L, Bx(0.105, 0.022, 0.25), _shade(boots, 0.55), 0, -0.458, 0.045);
  }

  const M = humanMaterial();
  for (const name in parts) {
    if (!parts[name].length) continue;
    const m = new THREE.Mesh(mergeColored(parts[name]), M);
    m.castShadow = true; m.receiveShadow = false;
    bones[name].add(m);
  }
  const H = o.height ?? 1.78;
  g.scale.setScalar(H / 1.78);

  // ---- animation ----
  const B = bones;
  let ph = 0, t = rnd(0, 10), crouch = 0, sit = 0, talk = 0, point = 0, wave = 0, hold = 0;
  const pointDir = { y: 0 };
  g.userData = {
    bones, caseLights, headG: B.neck, height: H, look: o,
    anim(dt, speed, st = {}) {
      t += dt;
      const moving = speed > 0.25;
      const run = speed > 4.8;
      const stride = clamp(speed / 3.5, 0, 1.2);
      ph += dt * (moving ? 2.4 + speed * 1.45 : 0);
      const sn = Math.sin(ph), cs = Math.cos(ph);
      crouch = damp(crouch, st.crouch ? 1 : 0, 8, dt);
      sit = damp(sit, st.sit ? 1 : 0, 6, dt);
      talk = damp(talk, st.talk ? 1 : 0, 5, dt);
      point = damp(point, st.point ? 1 : 0, 6, dt);
      wave = damp(wave, st.wave ? 1 : 0, 5, dt);
      hold = damp(hold, st.hold ? 1 : 0, 5, dt);
      const free = 1 - sit;
      const legA = (run ? 0.78 : 0.48) * stride * free;
      const armA = (run ? 0.85 : 0.38) * stride * free * (1 - hold);
      // legs: thigh swing, knee flex on the recovery half of the stride
      B.thL.rotation.x = -sn * legA - crouch * 1.05 - sit * 1.52;
      B.thR.rotation.x = sn * legA - crouch * 1.05 - sit * 1.52;
      B.knL.rotation.x = Math.max(0, Math.sin(ph + 1.25)) * legA * 1.45 + crouch * 1.95 + sit * 1.5;
      B.knR.rotation.x = Math.max(0, Math.sin(ph + 1.25 + Math.PI)) * legA * 1.45 + crouch * 1.95 + sit * 1.5;
      B.thL.rotation.z = 0.02 + sit * 0.06; B.thR.rotation.z = -0.02 - sit * 0.06;
      // hips: bob twice per stride, weight shift when idle
      const idleShift = moving ? 0 : Math.sin(t * 0.45) * 0.012;
      B.hips.position.y = 0.94 - crouch * 0.37 - sit * 0.43 + (moving ? Math.abs(cs) * 0.032 * stride : 0);
      B.hips.position.x = idleShift;
      B.hips.rotation.z = moving ? sn * 0.03 * stride : idleShift * 1.5;
      // spine: lean with speed, counter-twist, breathing
      const breathe = Math.sin(t * 1.65) * 0.012;
      B.spine.rotation.x = crouch * 0.4 + (run ? 0.17 : 0.04 * stride) + breathe - sit * 0.04 + hold * 0.05;
      B.spine.rotation.y = damp(B.spine.rotation.y, sn * 0.09 * stride + point * clamp(pointDir.y, -0.6, 0.6), 8, dt);
      // arms
      const bend = run ? 1.0 : 0.22 + 0.2 * stride;
      B.shL.rotation.x = sn * armA - crouch * 0.35 - sit * 0.38 - hold * 0.45 + Math.sin(t * 1.1) * 0.015;
      B.shR.rotation.x = -sn * armA - crouch * 0.35 - sit * 0.38 - hold * 0.45 + Math.sin(t * 1.1 + 1) * 0.015;
      B.shL.rotation.z = 0.07 + sit * 0.05; B.shR.rotation.z = -0.07 - sit * 0.05;
      B.elL.rotation.x = -bend - crouch * 0.5 - sit * 0.85 - hold * 1.1;
      B.elR.rotation.x = -bend - crouch * 0.5 - sit * 0.85 - hold * 1.1;
      // right-hand gestures: talking, pointing, waving
      if (talk > 0.01) {
        B.shR.rotation.x = lerp(B.shR.rotation.x, -0.5 + Math.sin(t * 2.3) * 0.16, talk);
        B.elR.rotation.x = lerp(B.elR.rotation.x, -1.15 + Math.sin(t * 3.4) * 0.22, talk);
        B.shR.rotation.z = lerp(B.shR.rotation.z, -0.22, talk);
        B.shL.rotation.x = lerp(B.shL.rotation.x, -0.12 + Math.sin(t * 1.7) * 0.06, talk * 0.6);
      }
      if (point > 0.01) { B.shR.rotation.x = lerp(B.shR.rotation.x, -1.5, point); B.elR.rotation.x = lerp(B.elR.rotation.x, -0.08, point); B.shR.rotation.z = lerp(B.shR.rotation.z, -0.1, point); }
      if (wave > 0.01) { B.shR.rotation.x = lerp(B.shR.rotation.x, -0.25, wave); B.shR.rotation.z = lerp(B.shR.rotation.z, -2.5, wave); B.elR.rotation.x = lerp(B.elR.rotation.x, -0.5 + Math.sin(t * 7) * 0.35, wave); }
      // head: look target, small nods while talking
      const ly = clamp(st.lookY ?? 0, -1.1, 1.1), lx = clamp(st.lookX ?? 0, -0.5, 0.5);
      B.neck.rotation.y = damp(B.neck.rotation.y, ly, 4, dt);
      B.neck.rotation.x = damp(B.neck.rotation.x, lx + talk * Math.sin(t * 4.2) * 0.04 - crouch * 0.25 + (run ? -0.1 : 0), 5, dt);
      if (st.pointYaw !== undefined) pointDir.y = st.pointYaw;
    },
  };
  return g;
}
