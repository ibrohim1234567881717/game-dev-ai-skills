// ============================================================
// 25-creatures.js — low-poly procedural animals and people
// Every builder returns a Group whose local +Z is "forward".
// g.userData.anim(dt, speed, state) drives the procedural animation.
// ============================================================
function limb(parent, x, y, z, len, r, m, o = {}) {
  const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
  const up = mesh(G.cyl(r * (o.taper ?? 0.8), r, len * 0.55, 6), m, { parent: pivot, pos: [0, -len * 0.27, 0] });
  const knee = new THREE.Group(); knee.position.set(0, -len * 0.55, 0); pivot.add(knee);
  mesh(G.cyl(r * 0.6, r * 0.75, len * 0.5, 6), m, { parent: knee, pos: [0, -len * 0.24, o.shin ?? 0] });
  mesh(G.box(r * 1.8, r * 0.5, r * 2.4), m, { parent: knee, pos: [0, -len * 0.48, r * 0.6] });
  return { pivot, knee, up };
}

// Draw-call reduction. The static meshes hanging off each node of a rig are merged into one
// mesh per material, so a triceratops costs ~16 draw calls instead of ~33 (the herd alone was
// most of the valley's calls). Groups keep their transforms, so code that rotates head, neck,
// jaw or legs is unaffected. Meshes referenced from userData or passed in `keep` stay separate,
// as do meshes with children. Call it at the end of a builder, before anything is rendered.
function bakeRig(root, keep = []) {
  const held = new Set();
  const mark = (v, depth) => {
    if (!v || depth > 3) return;
    if (v.isObject3D) { held.add(v); return; }
    if (Array.isArray(v)) v.forEach((x) => mark(x, depth + 1));
    else if (typeof v === 'object' && v.constructor === Object) Object.values(v).forEach((x) => mark(x, depth + 1));
  };
  mark(root.userData, 0); mark(keep, 0);
  const nodes = [];
  root.traverse((n) => { if (n.children.length > 1) nodes.push(n); });
  for (const node of nodes) {
    const buckets = new Map();
    for (const c of node.children) {
      if (!c.isMesh || c.isInstancedMesh || c.isSkinnedMesh || c.children.length || held.has(c) || Array.isArray(c.material) || !c.visible) continue;
      const key = c.material.uuid + (c.castShadow ? 'C' : '') + (c.receiveShadow ? 'R' : '');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const merged = new THREE.Mesh(mergeTransformed(list), list[0].material);
      merged.castShadow = list[0].castShadow; merged.receiveShadow = list[0].receiveShadow;
      list.forEach((c) => node.remove(c));
      node.add(merged);
    }
  }
  return root;
}
// Far LOD for herd animals: the whole rig in its rest pose as one vertex-coloured mesh. World.cull
// shows it beyond `far` metres and hides the animated parts, so a grazing herd across the valley
// costs one draw call per animal. At that distance the missing leg swing is not readable.
const LOD_K = () => GFX.pick([0.65, 0.85, 1, 1.35]);
const _lodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true, envMapIntensity: 0.55 });
function rigLOD(root, far) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), list = [];
  root.traverse((c) => {
    if (!c.isMesh || Array.isArray(c.material) || c.material.transparent) return;
    let v = true; for (let p = c; p && p !== root; p = p.parent) if (!p.visible) v = false;
    if (v) list.push(c);
  });
  const stand = list.map((c) => {
    const g = c.geometry.clone();
    // the far mesh carries the colours: the material's, times the vertex colours where the part has them
    const col = c.material.color || new THREE.Color('#888888'), n = g.attributes.position.count, C = new Float32Array(n * 3), vc = c.material.vertexColors && g.attributes.color;
    for (let i = 0; i < n; i++) { C[i * 3] = col.r * (vc ? vc.getX(i) : 1); C[i * 3 + 1] = col.g * (vc ? vc.getY(i) : 1); C[i * 3 + 2] = col.b * (vc ? vc.getZ(i) : 1); }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    const m = new THREE.Mesh(g); m.matrixAutoUpdate = false;
    m.matrix.multiplyMatrices(inv, c.matrixWorld);
    return m;
  });
  const lod = new THREE.Mesh(mergeTransformed(stand), _lodMat);
  lod.castShadow = true; lod.visible = false;
  root.userData.lodNear = root.children.slice();
  root.add(lod);
  root.userData.lodMesh = lod; root.userData.lodFar = far;
  return root;
}
// merge meshes that share a parent into one geometry expressed in that parent's space
function mergeTransformed(list) {
  const parts = list.map((c) => {
    if (c.matrixAutoUpdate) c.updateMatrix(); // rigLOD passes precomputed (possibly sheared) matrices
    const g = c.geometry.clone().applyMatrix4(c.matrix);
    if (!g.index) { const idx = new Array(g.attributes.position.count); for (let i = 0; i < idx.length; i++) idx[i] = i; g.setIndex(idx); }
    if (c.matrix.determinant() < 0) { const ix = g.index; for (let k = 0; k < ix.count; k += 3) { const b = ix.getX(k + 1); ix.setX(k + 1, ix.getX(k + 2)); ix.setX(k + 2, b); } }
    return g;
  });
  const withUV = parts.every((g) => g.attributes.uv), withC = parts.every((g) => g.attributes.color && g.attributes.color.itemSize === 3);
  let nv = 0, ni = 0;
  parts.forEach((g) => { nv += g.attributes.position.count; ni += g.index.count; });
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = withUV ? new Float32Array(nv * 2) : null, C = withC ? new Float32Array(nv * 3) : null;
  const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ca = g.attributes.color, ix = g.index;
    for (let i = 0; i < pa.count; i++) {
      const k = (vo + i) * 3;
      P[k] = pa.getX(i); P[k + 1] = pa.getY(i); P[k + 2] = pa.getZ(i);
      N[k] = na.getX(i); N[k + 1] = na.getY(i); N[k + 2] = na.getZ(i);
      if (U) { U[(vo + i) * 2] = ua.getX(i); U[(vo + i) * 2 + 1] = ua.getY(i); }
      if (C) { C[k] = ca.getX(i); C[k + 1] = ca.getY(i); C[k + 2] = ca.getZ(i); }
    }
    for (let k = 0; k < ix.count; k++) I[io + k] = ix.getX(k) + vo;
    vo += pa.count; io += ix.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  if (U) out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  if (C) out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setIndex(new THREE.BufferAttribute(I, 1));
  out.computeBoundingSphere();
  return out;
}

// ---------- smooth bodies ----------
// A body lofted along z through elliptical sections [[z, y, rx, ry], ...], smoothed between them
// (Catmull-Rom), capped at both ends. Vertex colours: o.back on top, o.belly underneath, dark
// bands across the back (o.bands per metre), mottling (o.mottle); UVs run around and along it
// for the shared skin bump. o.axis 'y' stands it up (a neck segment).
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function bodyLoft(sec, o = {}) {
  const seg = o.seg || 14, sub = o.sub || 3, n = sec.length, S = [];
  const cr = (i, t) => { const p0 = sec[Math.max(0, i - 1)], p1 = sec[i], p2 = sec[i + 1], p3 = sec[Math.min(n - 1, i + 2)];
    return p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t)); };
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < sub; k++) S.push(cr(i, k / sub));
  S.push(sec[n - 1]);
  const P = [], U = [], I = [];
  let len = 0;
  S.forEach(([z, y, rx, ry], i) => {
    if (i) len += Math.hypot(z - S[i - 1][0], y - S[i - 1][1]);
    for (let j = 0; j <= seg; j++) { const a = (j / seg) * TAU; P.push(Math.cos(a) * rx, y + Math.sin(a) * ry, z); U.push((j / seg) * (rx + ry) * 3.1 / (o.tile || 1.2), len / (o.tile || 1.2)); }
  });
  // faces point outward whichever way along z the sections run (a tail runs backward)
  const rows = S.length, w = seg + 1, fwd = S[rows - 1][0] >= S[0][0];
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < seg; j++) { const a = i * w + j, b = a + w; if (fwd) I.push(a, a + 1, b, a + 1, b + 1, b); else I.push(a, b, a + 1, a + 1, b, b + 1); }
  // caps: a centre vertex at each end, facing away from the body
  for (const [ri, first] of [[0, true], [rows - 1, false]]) {
    const [z, y] = S[ri], c = P.length / 3; P.push(0, y, z); U.push(0, 0);
    for (let j = 0; j < seg; j++) { const a = ri * w + j; if (first === fwd) I.push(c, a + 1, a); else I.push(c, a, a + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  g.computeVertexNormals();
  const back = new THREE.Color(o.back || '#666248'), belly = new THREE.Color(o.belly || o.back || '#8a8466'), pn = g.attributes.normal, pp = g.attributes.position, C = new Float32Array(pp.count * 3);
  for (let i = 0; i < pp.count; i++) {
    const ny = pn.getY(i), z = pp.getZ(i), x = pp.getX(i);
    _c1.copy(belly).lerp(back, smoothstep(-0.35, 0.45, ny));
    if (o.bands) { const band = Math.sin(z * o.bands * TAU + Math.sin(x * 2.1) * 0.6); if (band > 0.35 && ny > 0.1) _c1.multiplyScalar(1 - 0.18 * smoothstep(0.35, 0.8, band) * smoothstep(0.1, 0.6, ny)); }
    if (o.mottle) _c1.multiplyScalar(1 - o.mottle * (0.5 + 0.5 * Math.sin(x * 3.7 + z * 2.3) * Math.sin(z * 1.9 - pp.getY(i) * 3.1)));
    C[i * 3] = _c1.r; C[i * 3 + 1] = _c1.g; C[i * 3 + 2] = _c1.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  if (o.axis === 'y') { g.rotateX(-Math.PI / 2); }
  return g;
}
// a horn along a quadratic curve, tapering to a point
function hornGeo(len, r, bend = 0.3, seg = 7) {
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, bend * len, len * 0.5), new THREE.Vector3(0, bend * len * 0.5, len));
  const g = new THREE.TubeGeometry(curve, 8, r, seg, false), p = g.attributes.position;
  // TubeGeometry is round all the way: pull each ring toward the curve by how far along it is
  const pt = new THREE.Vector3();
  for (let i = 0; i <= 8; i++) { const t = i / 8, k = 1 - t * 0.94; curve.getPoint(t, pt); for (let j = 0; j <= seg; j++) { const v = i * (seg + 1) + j; p.setXYZ(v, pt.x + (p.getX(v) - pt.x) * k, pt.y + (p.getY(v) - pt.y) * k, pt.z + (p.getZ(v) - pt.z) * k); } }
  g.computeVertexNormals();
  return g;
}
// vertex-coloured skin with a fine scaly bump, shared by every smooth animal
let _skinMat = null;
function skinMat() {
  if (_skinMat) return _skinMat;
  const bump = detailTexture('rock');
  return (_skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, envMapIntensity: 0.5, bumpMap: GFX.level > 0 ? bump : null, bumpScale: 0.9 }));
}
// a leg of two lofted segments and a padded foot; returns the same { pivot, knee } as limb()
function limbSmooth(parent, x, y, z, len, r, col, o = {}) {
  // legs take the back's colour: the loft's belly side would face sideways once it is stood up
  const M = skinMat(), c = { back: col.back, belly: col.back, seg: 10, sub: 2 };
  const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
  const up = mesh(bodyLoft([[0.25, 0, r * 1.25, r * 1.3], [-len * 0.2, 0, r * 1.05, r * 1.1], [-len * 0.45, 0, r * 0.78, r * 0.8], [-len * 0.6, 0, r * 0.7, r * 0.72]], { ...c, axis: 'y' }), M, { parent: pivot });
  const knee = new THREE.Group(); knee.position.set(0, -len * 0.55, 0); pivot.add(knee);
  mesh(bodyLoft([[0.08, o.shin ?? 0, r * 0.72, r * 0.74], [-len * 0.25, o.shin ?? 0, r * 0.62, r * 0.64], [-len * 0.46, 0, r * 0.66, r * 0.7]], { ...c, axis: 'y' }), M, { parent: knee });
  mesh(G.sphere(1, 10, 7), mat(col.foot || '#3a3628', { flat: false, rough: 0.9 }), { parent: knee, pos: [0, -len * 0.47, r * 0.25], scale: [r * 0.95, r * 0.45, r * 1.15] });
  if (o.toes) for (const dx of [-0.5, 0, 0.5]) mesh(G.cone(r * 0.16, r * 0.4, 5), mat('#26221c', { rough: 0.4 }), { parent: knee, pos: [dx * r, -len * 0.5, r * 1.2], rot: [Math.PI / 2, 0, 0], cast: false });
  return { pivot, knee, up };
}

// ---------- Triceratops ----------
// A smooth, lofted body with a scalloped, patterned frill and curved brow horns. The rig is the
// one TriHerd and the cutscenes drive: body, tail, neck > head, four legs with knees.
function makeTriceratops(o = {}) {
  const skin = o.skin || '#6d6a4f', backC = new THREE.Color(skin).multiplyScalar(0.82).getStyle(), belly = o.belly || new THREE.Color(skin).lerp(new THREE.Color('#b8b08a'), 0.45).getStyle();
  const frillC = o.frill || '#8a4b2c', SK = skinMat(), MH = mat('#ddd2b2', { rough: 0.5, flat: false });
  const col = { back: backC, belly, foot: '#4a4434' };
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 1.78; g.add(body);
  mesh(bodyLoft([[-2.7, 0.15, 0.62, 0.6], [-2.2, 0.26, 0.98, 0.96], [-1.5, 0.34, 1.28, 1.22], [-0.6, 0.22, 1.46, 1.32], [0.4, 0.06, 1.5, 1.3], [1.3, -0.04, 1.36, 1.16], [2.0, 0.0, 1.06, 0.98], [2.75, 0.04, 0.72, 0.74]],
    { back: backC, belly, bands: 0.42, mottle: 0.06, seg: 16 }), SK, { parent: body });
  const tail = new THREE.Group(); tail.position.set(0, 0.1, -2.6); body.add(tail);
  mesh(bodyLoft([[0.25, 0.05, 0.64, 0.62], [-0.8, -0.05, 0.46, 0.48], [-1.9, -0.25, 0.26, 0.28], [-3.1, -0.45, 0.1, 0.11], [-3.5, -0.5, 0.03, 0.03]], { back: backC, belly, bands: 0.42, seg: 12 }), SK, { parent: tail });
  const neck = new THREE.Group(); neck.position.set(0, -0.05, 2.5); body.add(neck);
  mesh(bodyLoft([[-0.1, 0.02, 0.74, 0.76], [0.3, 0.0, 0.68, 0.72], [0.65, 0.02, 0.64, 0.7]], { back: backC, belly, seg: 12, sub: 2 }), SK, { parent: neck });
  const head = new THREE.Group(); head.position.set(0, -0.05, 0.5); neck.add(head);
  mesh(bodyLoft([[-0.35, 0.16, 0.6, 0.7], [0.2, 0.12, 0.8, 0.86], [0.8, 0.0, 0.72, 0.8], [1.35, -0.14, 0.5, 0.62], [1.8, -0.3, 0.3, 0.42], [2.12, -0.44, 0.12, 0.2]], { back: backC, belly, seg: 14 }), SK, { parent: head });
  mesh(G.cone(0.14, 0.45, 8), mat('#2e2a22', { rough: 0.45, flat: false }), { parent: head, pos: [0, -0.52, 2.18], rot: [Math.PI / 2 + 0.55, 0, 0], cast: false });
  // the frill: a scalloped shield leaning back over the neck, dark at the rim, with two pale eye-spots
  const fs = new THREE.Shape(), FN = 40;
  for (let i = 0; i <= FN; i++) { const a = Math.PI * (-0.08 + 1.16 * i / FN), sc = 1 + 0.07 * Math.max(0, Math.sin(i / FN * Math.PI * 9)); const px = Math.cos(a) * 1.8 * sc, py = Math.sin(a) * 1.55 * sc - 0.2; if (i) fs.lineTo(px, py); else fs.moveTo(px, py); }
  fs.lineTo(0, -0.45);
  const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 2, curveSegments: 4 });
  { const fp = fg.attributes.position, FC = new Float32Array(fp.count * 3), base = new THREE.Color(frillC).lerp(new THREE.Color('#c07a44'), 0.35), rim = new THREE.Color(frillC).multiplyScalar(0.42), spot = new THREE.Color('#e0d2a8');
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), y = fp.getY(i), r = Math.hypot(x / 1.8, (y + 0.2) / 1.55);
      _c2.copy(base).lerp(rim, smoothstep(0.62, 0.98, r));
      const e = Math.min(Math.hypot(x - 0.85, y - 0.62), Math.hypot(x + 0.85, y - 0.62)); _c2.lerp(spot, (1 - smoothstep(0.16, 0.3, e)) * 0.85);
      FC[i * 3] = _c2.r; FC[i * 3 + 1] = _c2.g; FC[i * 3 + 2] = _c2.b; }
    fg.setAttribute('color', new THREE.BufferAttribute(FC, 3)); fg.computeVertexNormals(); }
  const frill = mesh(fg, SK, { parent: head, pos: [0, 0.62, 0.02], rot: [-0.36, 0, 0], scale: [0.74, 0.74, 1] });
  // the edge knobs round the frill
  for (let i = 0; i < 11; i++) { const a = Math.PI * (0.02 + 0.96 * i / 10); mesh(G.cone(0.1, 0.32, 5), MH, { parent: frill, pos: [Math.cos(a) * 1.86, Math.sin(a) * 1.6 - 0.2, 0.05], rot: [0, 0, a - Math.PI / 2], cast: false }); }
  const brow = [];
  for (const sx of [-1, 1]) { const h = mesh(hornGeo(1.45, 0.19, 0.28), MH, { parent: head, pos: [sx * 0.4, 0.62, 0.95], rot: [-0.72, sx * 0.1, 0] }); brow.push(h); }
  mesh(hornGeo(0.45, 0.13, 0.15), MH, { parent: head, pos: [0, 0.2, 1.72], rot: [-1.1, 0, 0] });
  for (const sx of [-1, 1]) mesh(G.cone(0.14, 0.4, 6), MH, { parent: head, pos: [sx * 0.72, -0.25, 0.65], rot: [0, 0, sx * -2.2], cast: false });
  if (o.broken) { brow[0].scale.set(1, 1, 0.38); }
  for (const sx of [-1, 1]) mesh(G.sphere(0.085, 8, 6), mat('#120e08', { rough: 0.25, flat: false }), { parent: head, pos: [sx * 0.66, 0.3, 0.98], cast: false });
  // legs
  const legs = [
    limbSmooth(g, -1.05, 1.5, 1.7, 1.55, 0.44, col, { toes: true }), limbSmooth(g, 1.05, 1.5, 1.7, 1.55, 0.44, col, { toes: true }),
    limbSmooth(g, -1.12, 1.62, -1.5, 1.65, 0.52, col, { toes: true }), limbSmooth(g, 1.12, 1.62, -1.5, 1.65, 0.52, col, { toes: true }),
  ];
  const s = o.scale ?? 1;
  g.scale.setScalar(s);
  let ph = rnd(0, TAU);
  g.userData = {
    head, neck, tail, legs, body, kind: 'tri',
    anim(dt, speed, st = {}) {
      ph += dt * (0.9 + speed * 1.15) * TAU * 0.45 / Math.max(0.6, s);
      const a = clamp(speed / 3, 0, 1) * 0.42;
      legs[0].pivot.rotation.x = Math.sin(ph) * a; legs[3].pivot.rotation.x = Math.sin(ph) * a;
      legs[1].pivot.rotation.x = Math.sin(ph + Math.PI) * a; legs[2].pivot.rotation.x = Math.sin(ph + Math.PI) * a;
      legs.forEach((l) => { l.knee.rotation.x = Math.max(0, -l.pivot.rotation.x) * 0.9; });
      body.position.y = 1.78 + Math.abs(Math.sin(ph)) * 0.08 * clamp(speed, 0, 1);
      // breathing, and the tail swinging with the stride
      body.scale.set(1 + Math.sin(Game.time * 1.1 + ph) * 0.006, 1 + Math.sin(Game.time * 1.1 + ph) * 0.01, 1);
      tail.rotation.y = Math.sin(ph * 0.5) * 0.18 + Math.sin(Game.time * 0.4 + ph) * 0.05;
      const headDown = st.graze ? 0.62 : st.alert ? -0.28 : st.charge ? 0.35 : 0.05;
      neck.rotation.x = damp(neck.rotation.x, headDown + Math.sin(Game.time * 1.3 + ph) * 0.03, 3, dt);
      neck.rotation.y = damp(neck.rotation.y, st.look ?? 0, 3, dt);
    },
  };
  return rigLOD(bakeRig(g), 105 * LOD_K());
}

// ---------- Brachiosaurus ----------
// Lofted body sloping down from high shoulders, a neck of rounded segments (the rig's six), a head
// with the raised nasal crest, pillar legs, a long drooping tail. Mottled grey-green.
function makeBrachio() {
  const back = '#56624f', belly = '#8c937f', SK = skinMat(), col = { back, belly, foot: '#3c3a32' };
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 6; g.add(body);
  mesh(bodyLoft([[-4.4, -0.3, 1.0, 1.05], [-3.6, -0.05, 1.65, 1.75], [-2.4, 0.2, 2.15, 2.15], [-0.8, 0.3, 2.38, 2.32], [0.8, 0.5, 2.32, 2.32], [2.4, 0.85, 2.0, 2.05], [3.6, 1.25, 1.3, 1.38], [4.2, 1.5, 0.86, 0.92]],
    { back, belly, mottle: 0.1, seg: 18 }), SK, { parent: body });
  mesh(bodyLoft([[-4.2, -0.25, 1.0, 1.05], [-6.2, -0.8, 0.72, 0.75], [-8.6, -1.6, 0.42, 0.44], [-11.2, -2.4, 0.18, 0.18], [-13.2, -2.7, 0.05, 0.05]], { back, belly, mottle: 0.1, seg: 12 }), SK, { parent: body });
  const neck = new THREE.Group(); neck.position.set(0, 1.4, 3.6); body.add(neck);
  const segs = [];
  let parent = neck;
  for (let i = 0; i < 6; i++) {
    const sg = new THREE.Group(); sg.position.set(0, i === 0 ? 0 : 2.1, 0); parent.add(sg);
    const r0 = 0.84 - i * 0.085, r1 = 0.78 - i * 0.085;
    // each piece overlaps the next, so the bends read as one neck, not a stack of pipes
    mesh(bodyLoft([[-0.35, 0, r0 * 0.96, r0], [0.6, 0, r0 * 0.94, r0 * 1.02], [1.5, 0, r1 * 0.92, r1], [2.45, 0, r1 * 0.9, r1 * 0.96]], { back, belly, mottle: 0.1, seg: 12, sub: 2, axis: 'y' }), SK, { parent: sg });
    sg.rotation.x = i === 0 ? -0.35 : -0.03;
    segs.push(sg); parent = sg;
  }
  const head = new THREE.Group(); head.position.set(0, 2.2, 0.2); parent.add(head);
  mesh(bodyLoft([[-0.35, 0.1, 0.34, 0.38], [0.05, 0.3, 0.42, 0.5], [0.45, 0.36, 0.38, 0.46], [0.85, 0.18, 0.32, 0.32], [1.2, 0.06, 0.26, 0.24], [1.42, 0.02, 0.16, 0.14]], { back, belly, seg: 12 }), SK, { parent: head, rot: [0.25, 0, 0] });
  for (const sx of [-1, 1]) mesh(G.sphere(0.06, 6, 5), mat('#120e08', { rough: 0.25, flat: false }), { parent: head, pos: [sx * 0.36, 0.34, 0.35], cast: false });
  const legs = [[-1.6, 5.3, 2.6, 5.5], [1.6, 5.3, 2.6, 5.5], [-1.6, 5.0, -2.8, 5.1], [1.6, 5.0, -2.8, 5.1]].map(([x, y, z, l]) => limbSmooth(g, x, y, z, l, 0.72, col));
  let ph = 0, drink = 0;
  g.userData = {
    neck, segs, head, legs, kind: 'bra', drinking: false,
    anim(dt, speed) {
      ph += dt * (0.4 + speed * 0.5) * TAU * 0.3;
      const a = clamp(speed, 0, 1) * 0.25;
      legs[0].pivot.rotation.x = legs[3].pivot.rotation.x = Math.sin(ph) * a;
      legs[1].pivot.rotation.x = legs[2].pivot.rotation.x = -Math.sin(ph) * a;
      drink = damp(drink, g.userData.drinking ? 1 : 0, 0.8, dt);
      segs[0].rotation.x = lerp(-0.35, 1.05, drink) + Math.sin(Game.time * 0.4) * 0.04;
      for (let i = 1; i < segs.length; i++) segs[i].rotation.x = lerp(-0.03, 0.2, drink) + Math.sin(Game.time * 0.5 + i) * 0.02;
      neck.rotation.y = Math.sin(Game.time * 0.23) * 0.25;
      body.scale.set(1 + Math.sin(Game.time * 0.6) * 0.005, 1 + Math.sin(Game.time * 0.6) * 0.008, 1);
    },
  };
  return rigLOD(bakeRig(g), 170 * LOD_K());
}

// ---------- Compsognathus ----------
function makeCompy() {
  const M = mat('#6a7a3d'), g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.42; g.add(body);
  mesh(G.sphere(0.18, 8, 6), M, { parent: body, scale: [1, 0.9, 1.7] });
  mesh(G.cone(0.1, 0.6, 5), M, { parent: body, rot: [-Math.PI / 2, 0, 0], pos: [0, 0, -0.5] });
  const head = mesh(G.box(0.12, 0.12, 0.24), M, { parent: body, pos: [0, 0.17, 0.33] });
  const legs = [mesh(G.box(0.05, 0.36, 0.05), M, { parent: g, pos: [-0.08, 0.2, 0] }), mesh(G.box(0.05, 0.36, 0.05), M, { parent: g, pos: [0.08, 0.2, 0] })];
  let ph = rnd(0, TAU);
  g.userData = {
    kind: 'compy', head,
    anim(dt, speed, st = {}) {
      ph += dt * (4 + speed * 3);
      legs[0].rotation.x = Math.sin(ph) * 0.8 * clamp(speed, 0, 1); legs[1].rotation.x = -legs[0].rotation.x;
      body.position.y = 0.42 + Math.abs(Math.sin(ph)) * 0.06 * clamp(speed, 0.2, 1);
      head.rotation.x = st.peck ? Math.max(0, Math.sin(Game.time * 9 + ph)) * 0.9 : 0;
    },
  };
  return rigLOD(bakeRig(g, legs), 42 * LOD_K());
}

// ---------- Velociraptor (Varn's reconstruction) ----------
function makeRaptor(o = {}) {
  // lofted and striped, a crest of quills down the neck and back, feathered arms, the sickle claw
  const skin = o.skin || '#5a5a48', stripe = o.stripe || '#3a3b30', SK = skinMat();
  const back = new THREE.Color(skin).multiplyScalar(0.9).getStyle(), belly = new THREE.Color(skin).lerp(new THREE.Color('#b0a88a'), 0.45).getStyle();
  const MF = mat('#2c2a24'), MC = mat('#d8d0bb', { rough: 0.5 }), MQ = mat(stripe, { side: THREE.DoubleSide });
  const col = { back, belly, foot: '#3a3a30' }, bands = { back, belly, bands: 1.3, mottle: 0.05 };
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 1.15; g.add(body);
  mesh(bodyLoft([[-0.9, 0.04, 0.26, 0.3], [-0.5, 0.08, 0.36, 0.42], [0.0, 0.05, 0.42, 0.46], [0.45, 0.1, 0.36, 0.4], [0.82, 0.22, 0.22, 0.26]], { ...bands, seg: 12 }), SK, { parent: body });
  // quills down the back (the stripes are in the skin's vertex colour)
  const quill = new THREE.PlaneGeometry(0.05, 0.22); quill.translate(0, 0.11, 0);
  for (let i = 0; i < 9; i++) mesh(quill, MQ, { parent: body, pos: [0, 0.44 + Math.sin(i / 8 * Math.PI) * 0.06, 0.6 - i * 0.17], rot: [-0.9, 0, 0], cast: false });
  const tail = new THREE.Group(); tail.position.set(0, 0.05, -0.85); body.add(tail);
  mesh(bodyLoft([[0.12, 0, 0.26, 0.29], [-0.7, 0.02, 0.17, 0.2], [-1.5, 0.04, 0.09, 0.11], [-2.2, 0.06, 0.03, 0.04]], { ...bands, seg: 10 }), SK, { parent: tail });
  // the tail's feather fan
  const plume = new THREE.Group(); plume.position.set(0, 0.06, -1.9); tail.add(plume);
  for (let i = -3; i <= 3; i++) mesh(new THREE.PlaneGeometry(0.09, 0.55).translate(0, -0.27, 0), MQ, { parent: plume, rot: [Math.PI / 2, 0, i * 0.16], cast: false });
  const neck = new THREE.Group(); neck.position.set(0, 0.25, 0.8); body.add(neck);
  mesh(bodyLoft([[-0.1, -0.05, 0.19, 0.21], [0.18, 0.14, 0.15, 0.17], [0.36, 0.34, 0.13, 0.15], [0.44, 0.46, 0.12, 0.14]], { back, belly, seg: 10, sub: 2 }), SK, { parent: neck });
  const head = new THREE.Group(); head.position.set(0, 0.42, 0.42); neck.add(head);
  mesh(bodyLoft([[-0.14, 0.03, 0.12, 0.14], [0.06, 0.04, 0.14, 0.15], [0.3, 0.0, 0.11, 0.12], [0.52, -0.04, 0.07, 0.08], [0.6, -0.05, 0.03, 0.04]], { back, belly, seg: 10 }), SK, { parent: head });
  const jaw = new THREE.Group(); jaw.position.set(0, -0.08, 0); head.add(jaw);
  mesh(bodyLoft([[0.0, -0.02, 0.09, 0.05], [0.25, -0.04, 0.08, 0.045], [0.5, -0.05, 0.04, 0.03]], { back: belly, belly, seg: 8, sub: 2 }), SK, { parent: jaw });
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) mesh(G.cone(0.012, 0.045, 3), MC, { parent: head, pos: [sx * (0.075 - i * 0.008), -0.075, 0.12 + i * 0.07], rot: [Math.PI, 0, 0], cast: false });
  const crest = new THREE.Group(); head.add(crest);
  for (let i = 0; i < 5; i++) mesh(quill, MQ, { parent: crest, pos: [0, 0.12, 0.1 - i * 0.07], rot: [-1.1 - i * 0.1, 0, 0], scale: [1, 0.8 - i * 0.08, 1], cast: false });
  if (o.notch) crest.scale.set(1, 1, 0.55);
  for (const sx of [-1, 1]) mesh(G.sphere(0.035, 6, 5), mat('#d9a520', { emissive: '#8a5a00', ei: 0.6, flat: false }), { parent: head, pos: [sx * 0.11, 0.07, 0.18], cast: false });
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * 0.28, -0.05, 0.55); body.add(arm);
    mesh(bodyLoft([[0.05, 0, 0.06, 0.06], [-0.3, 0, 0.04, 0.045]], { back, belly, seg: 6, sub: 1, axis: 'y' }), SK, { parent: arm, rot: [0.6, 0, 0] });
    for (let k = 0; k < 3; k++) mesh(new THREE.PlaneGeometry(0.05, 0.24).translate(0, -0.12, 0), MQ, { parent: arm, pos: [sx * 0.02, -0.1 - k * 0.05, -0.04 - k * 0.02], rot: [0.9, sx * 1.2, 0], cast: false });
    mesh(G.cone(0.015, 0.08, 4), MF, { parent: arm, pos: [0, -0.3, 0.12], rot: [1.9, 0, 0], cast: false });
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.26, 1.1, -0.15); g.add(hip);
    mesh(bodyLoft([[0.1, 0.04, 0.17, 0.2], [-0.2, 0.06, 0.15, 0.17], [-0.5, 0.12, 0.09, 0.1]], { back, belly: back, seg: 8, sub: 2, axis: 'y' }), SK, { parent: hip });
    const knee = new THREE.Group(); knee.position.set(0, -0.52, 0.15); hip.add(knee);
    mesh(bodyLoft([[0.04, 0, 0.08, 0.09], [-0.3, -0.12, 0.06, 0.065], [-0.54, -0.1, 0.05, 0.055]], { back, belly: back, seg: 8, sub: 2, axis: 'y' }), SK, { parent: knee });
    mesh(G.box(0.1, 0.05, 0.3), mat('#3a3a30'), { parent: knee, pos: [0, -0.56, 0.02] });
    mesh(hornGeo(0.2, 0.025, 0.6, 5), MC, { parent: knee, pos: [0.03 * sx, -0.5, 0.06], rot: [-2.4, 0, 0], cast: false });
    legs.push({ hip, knee });
  }
  let ph = rnd(0, TAU);
  g.userData = {
    kind: 'rap', head, jaw, neck, tail, plume, body,
    anim(dt, speed, st = {}) {
      ph += dt * (2 + speed * 1.6);
      const a = clamp(speed / 5, 0, 1) * 0.9;
      legs[0].hip.rotation.x = Math.sin(ph) * a; legs[1].hip.rotation.x = -Math.sin(ph) * a;
      legs[0].knee.rotation.x = Math.max(0, Math.sin(ph + 1)) * a * 1.2; legs[1].knee.rotation.x = Math.max(0, -Math.sin(ph + 1)) * a * 1.2;
      body.position.y = 1.15 + Math.abs(Math.sin(ph)) * 0.06 * clamp(speed, 0, 1) - (st.crouch ? 0.25 : 0);
      body.rotation.x = st.crouch ? 0.2 : speed > 5 ? 0.12 : 0;
      tail.rotation.y = Math.sin(ph * 0.5) * 0.15 * (1 + (st.alert ? 1 : 0));
      tail.rotation.x = -body.rotation.x * 0.8;
      head.rotation.z = damp(head.rotation.z, st.tilt ? 0.45 : 0, 6, dt);
      neck.rotation.x = damp(neck.rotation.x, st.sniff ? 0.5 : st.alert ? -0.2 : 0, 5, dt);
      jaw.rotation.x = damp(jaw.rotation.x, st.open ? 0.5 : 0, 10, dt);
    },
  };
  g.scale.setScalar(o.scale ?? 1.25);
  return bakeRig(g);
}

// ---------- Spinosaurus ----------
function makeSpino() {
  // lofted body, a paddle tail, a long croc-like snout, and the sail: a membrane on spines, red
  // at the top fading dark at the base
  const back = '#4c5a50', belly = '#8e9484', SK = skinMat(), col = { back, belly, foot: '#34382e' };
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 3.2; g.add(body);
  mesh(bodyLoft([[-3.9, 0.0, 0.92, 1.0], [-2.6, 0.1, 1.36, 1.45], [-1.0, 0.1, 1.56, 1.6], [0.8, 0.05, 1.5, 1.55], [2.4, 0.15, 1.2, 1.3], [3.6, 0.45, 0.8, 0.9], [4.25, 0.6, 0.6, 0.7]], { back, belly, mottle: 0.08, seg: 16 }), SK, { parent: body });
  // the sail: spines, and a membrane between them whose top edge dips between each pair
  {
    const n = 15, P = [], C = [], I = [], top = new THREE.Color('#c05036'), base = new THREE.Color('#4a2a20'), rows = 6;
    const hAt = (t) => Math.sin(t * Math.PI) * 4.3 * (0.86 + 0.14 * Math.sin(t * 5.3)) + 0.3;
    for (let i = 0; i <= n * 2; i++) {
      const t = i / (n * 2), z = -3.4 + t * 6.8, hTop = hAt(t) * (i % 2 ? 0.9 : 1);
      for (let r = 0; r <= rows; r++) { const k = r / rows; P.push(0, 1.0 + hTop * k, z); _c1.copy(base).lerp(top, Math.pow(k, 0.8)); C.push(_c1.r, _c1.g, _c1.b); }
      if (i < n * 2) for (let r = 0; r < rows; r++) { const a0 = i * (rows + 1) + r, b0 = a0 + rows + 1; I.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); sg.setIndex(I); sg.computeVertexNormals();
    const sailM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, emissive: new THREE.Color('#3a0e06'), emissiveIntensity: 0.6 });
    const sail = new THREE.Mesh(sg, sailM); sail.castShadow = true; body.add(sail);
    const spineM = mat('#5a2a1c', { flat: false });
    for (let i = 0; i <= n; i++) { const t = i / n, h = hAt(t); mesh(G.cyl(0.03, 0.07, h, 5), spineM, { parent: body, pos: [0, 1.0 + h / 2, -3.4 + t * 6.8], cast: false }); }
    // Charon's scar: a torn notch in the sail
    mesh(G.box(0.08, 1.1, 0.35), mat('#2a1a14'), { parent: body, pos: [0.02, 4.1, -0.7], rot: [0.3, 0, 0], cast: false });
  }
  const tail = new THREE.Group(); tail.position.set(0, 0, -3.9); body.add(tail);
  // a paddle: narrow side to side, deep top to bottom, the way Spinosaurus swam
  mesh(bodyLoft([[0.3, 0.0, 0.9, 1.0], [-1.6, 0.05, 0.62, 0.95], [-3.6, 0.1, 0.34, 0.8], [-5.6, 0.15, 0.14, 0.55], [-7.0, 0.2, 0.05, 0.22]], { back, belly, mottle: 0.08, seg: 12 }), SK, { parent: tail });
  const neck = new THREE.Group(); neck.position.set(0, 0.6, 3.9); body.add(neck);
  mesh(bodyLoft([[-0.3, -0.05, 0.66, 0.74], [0.6, 0.3, 0.55, 0.62], [1.4, 0.65, 0.48, 0.54], [2.1, 0.85, 0.44, 0.5]], { back, belly, mottle: 0.06, seg: 12, sub: 2 }), SK, { parent: neck });
  const head = new THREE.Group(); head.position.set(0, 0.9, 2.1); neck.add(head);
  mesh(bodyLoft([[-0.35, 0.1, 0.44, 0.44], [0.3, 0.16, 0.4, 0.4], [1.0, 0.06, 0.27, 0.27], [1.9, 0.0, 0.2, 0.19], [2.7, 0.02, 0.22, 0.2], [3.05, 0.0, 0.1, 0.11]], { back, belly, seg: 12 }), SK, { parent: head });
  mesh(G.cone(0.1, 0.5, 5), mat('#5a3a2a', { flat: false }), { parent: head, pos: [0, 0.42, 0.25], rot: [-0.3, 0, 0], cast: false });
  const jaw = new THREE.Group(); jaw.position.set(0, -0.2, 0.6); head.add(jaw);
  mesh(bodyLoft([[-0.8, -0.05, 0.36, 0.18], [0.4, -0.08, 0.22, 0.13], [1.6, -0.1, 0.17, 0.11], [2.4, -0.1, 0.18, 0.11], [2.5, -0.1, 0.08, 0.05]], { back: belly, belly, seg: 10 }), SK, { parent: jaw });
  const tooth = mat('#e2d8c0', { rough: 0.4 });
  for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) mesh(G.cone(0.03, 0.14, 4), tooth, { parent: head, pos: [sx * (0.19 - i * 0.004), -0.16, 0.9 + i * 0.22], rot: [Math.PI, 0, 0], cast: false });
  for (const sx of [-1, 1]) mesh(G.sphere(0.07, 6, 5), mat('#e8c24a', { emissive: '#704a00', flat: false }), { parent: head, pos: [sx * 0.38, 0.3, 0.55], cast: false });
  const legs = [limbSmooth(g, -1.2, 3.0, -1.4, 3.1, 0.55, col, { toes: true }), limbSmooth(g, 1.2, 3.0, -1.4, 3.1, 0.55, col, { toes: true })];
  const arms = [limbSmooth(g, -1.0, 2.7, 2.6, 2.0, 0.27, col, { toes: true }), limbSmooth(g, 1.0, 2.7, 2.6, 2.0, 0.27, col, { toes: true })];
  let ph = 0;
  g.userData = {
    kind: 'spi', head, jaw, neck, tail, body,
    anim(dt, speed, st = {}) {
      ph += dt * (1 + speed * 0.6);
      const a = clamp(speed / 5, 0, 1) * 0.5;
      legs[0].pivot.rotation.x = Math.sin(ph) * a; legs[1].pivot.rotation.x = -Math.sin(ph) * a;
      arms[0].pivot.rotation.x = -Math.sin(ph) * a * 0.6 + 0.3; arms[1].pivot.rotation.x = Math.sin(ph) * a * 0.6 + 0.3;
      tail.rotation.y = Math.sin(ph * 0.5 + Game.time) * 0.22;
      jaw.rotation.x = damp(jaw.rotation.x, st.open ? 0.55 : 0, 8, dt);
      neck.rotation.x = damp(neck.rotation.x, st.lunge ? 0.5 : st.up ? -0.4 : 0, 4, dt);
    },
  };
  return bakeRig(g);
}

// ---------- Deinosuchus (head + back only) ----------
function makeCroc() {
  const M = mat('#3c4632'), g = new THREE.Group();
  mesh(G.box(0.9, 0.35, 3.4), M, { parent: g, pos: [0, 0.05, 0] });
  mesh(G.box(0.55, 0.28, 1.4), M, { parent: g, pos: [0, 0.08, 2.2] });
  for (let i = 0; i < 6; i++) mesh(G.cone(0.12, 0.22, 4), M, { parent: g, pos: [0, 0.28, -1.4 + i * 0.5] });
  for (const sx of [-1, 1]) mesh(G.sphere(0.07, 5, 4), mat('#c9b04a', { emissive: '#5a4800' }), { parent: g, pos: [sx * 0.2, 0.25, 1.6], cast: false });
  g.userData = { kind: 'croc', anim() {} };
  return bakeRig(g);
}

// ---------- Pteranodon ----------
function makePtera(o = {}) {
  const M = mat(o.skin || '#8a6a4a'), MW = new THREE.MeshStandardMaterial({ color: o.wing || '#6e4a35', roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
  const MC = mat(o.crest || '#b84a2a');
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  mesh(G.sphere(0.28, 8, 6), M, { parent: body, scale: [1, 0.9, 2.3] });
  const head = new THREE.Group(); head.position.set(0, 0.22, 0.7); body.add(head);
  mesh(G.cone(0.1, 1.2, 5), M, { parent: head, rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.55] });
  mesh(G.cone(0.08, 1.0, 4), MC, { parent: head, rot: [-Math.PI / 2 - 0.3, 0, 0], pos: [0, 0.12, -0.45] });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.35, 3.2, 0.05, -0.1, 0, 0, -0.55, 3.2, 0.05, -0.1, 1.2, 0, -0.6, 0, 0, -0.55], 3));
  wingGeo.computeVertexNormals();
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group(); body.add(w);
    const m = new THREE.Mesh(wingGeo, MW); m.scale.x = sx; m.castShadow = true; w.add(m);
    wings.push(w);
  }
  let ph = rnd(0, TAU);
  g.userData = {
    kind: 'pte', wings, head, body,
    anim(dt, speed, st = {}) {
      ph += dt * (st.flap ? 7 : 1.5);
      const f = st.perched ? 0 : st.flap ? Math.sin(ph) * 0.7 : Math.sin(ph) * 0.08;
      const fold = st.perched ? 1.25 : st.dive ? 0.9 : 0;
      wings[0].rotation.z = -(f) - fold * 0.2; wings[1].rotation.z = f + fold * 0.2;
      wings[0].rotation.y = fold * 0.9; wings[1].rotation.y = -fold * 0.9;
      body.rotation.x = st.dive ? 0.7 : 0;
    },
  };
  g.scale.setScalar(o.scale ?? 1);
  return bakeRig(g);
}

// ---------- Tyrannosaurus ----------
// the author's skinned model when the build carries it (24-rex-model.js), this one when it does not
function makeRex() {
  return makeRexSkinned() || makeRexProcedural();
}
function makeRexProcedural() {
  const M = mat('#4d4436'), MB = mat('#7a6b54'), MT = mat('#e6dcc2', { rough: 0.5 });
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 4.1; g.add(body);
  mesh(G.sphere(1, 12, 9), M, { parent: body, scale: [1.7, 1.9, 3.6] });
  mesh(G.sphere(1, 10, 7), MB, { parent: body, pos: [0, -0.8, 0.5], scale: [1.4, 1.1, 2.8] });
  const tail = new THREE.Group(); tail.position.set(0, 0.2, -3.2); body.add(tail);
  const tail2 = new THREE.Group(); tail2.position.set(0, 0, -3.2); tail.add(tail2);
  mesh(G.cone(1.3, 3.6, 8), M, { parent: tail, rot: [-Math.PI / 2 - 0.05, 0, 0], pos: [0, 0, -1.6] });
  mesh(G.cone(0.75, 4.2, 7), M, { parent: tail2, rot: [-Math.PI / 2 - 0.05, 0, 0], pos: [0, 0, -1.9] });
  const neck = new THREE.Group(); neck.position.set(0, 1.0, 3.1); body.add(neck);
  mesh(G.cyl(1.0, 1.35, 2.2, 8), M, { parent: neck, rot: [0.9, 0, 0], pos: [0, 0.5, 0.6] });
  const head = new THREE.Group(); head.position.set(0, 1.25, 1.55); neck.add(head);
  mesh(G.box(1.35, 1.2, 2.6), M, { parent: head, pos: [0, 0.25, 0.9] });
  mesh(G.box(1.1, 0.8, 1.2), M, { parent: head, pos: [0, 0.3, 2.4] });
  for (const sx of [-1, 1]) {
    mesh(G.box(0.25, 0.3, 0.5), M, { parent: head, pos: [sx * 0.55, 0.95, 0.4] });
    mesh(G.sphere(0.09, 6, 4), mat('#d3a33a', { emissive: '#7a4a00', ei: 0.7 }), { parent: head, pos: [sx * 0.62, 0.7, 0.7], cast: false });
  }
  for (let i = 0; i < 9; i++) mesh(G.cone(0.06, 0.28, 4), MT, { parent: head, pos: [(i % 2 ? 0.5 : -0.5), -0.4, 0.8 + i * 0.3], rot: [Math.PI, 0, 0], cast: false });
  const jaw = new THREE.Group(); jaw.position.set(0, -0.35, 0.1); head.add(jaw);
  mesh(G.box(1.15, 0.45, 2.9), MB, { parent: jaw, pos: [0, -0.2, 1.3] });
  mesh(G.box(0.3, 0.12, 1.6), mat('#3a1814'), { parent: jaw, pos: [0.45, -0.02, 0.9], cast: false }); // D-03 scar
  for (let i = 0; i < 8; i++) mesh(G.cone(0.05, 0.24, 4), MT, { parent: jaw, pos: [(i % 2 ? 0.45 : -0.45), 0.08, 0.6 + i * 0.3], cast: false });
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * 1.0, -0.6, 2.4); body.add(arm);
    mesh(G.cyl(0.12, 0.16, 0.9, 5), M, { parent: arm, rot: [0.9, 0, 0], pos: [0, -0.2, 0.3] });
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 1.2, 3.9, -0.6); g.add(hip);
    mesh(G.sphere(1, 8, 6), M, { parent: hip, pos: [0, -0.6, 0.2], scale: [0.75, 1.3, 1.1] });
    const knee = new THREE.Group(); knee.position.set(0, -1.9, 0.5); hip.add(knee);
    mesh(G.cyl(0.35, 0.5, 2.1, 7), M, { parent: knee, pos: [0, -0.95, -0.35], rot: [0.35, 0, 0] });
    mesh(G.box(0.85, 0.3, 1.5), M, { parent: knee, pos: [0, -1.95, 0.2] });
    legs.push({ hip, knee });
  }
  let ph = 0, lastStep = 0;
  g.userData = {
    kind: 'rex', head, jaw, neck, tail, tail2, body, stepCb: null,
    anim(dt, speed, st = {}) {
      ph += dt * (0.8 + speed * 0.32);
      const a = clamp(speed / 6, 0, 1) * 0.55;
      legs[0].hip.rotation.x = Math.sin(ph) * a; legs[1].hip.rotation.x = -Math.sin(ph) * a;
      legs[0].knee.rotation.x = Math.max(0, Math.sin(ph + 1)) * a; legs[1].knee.rotation.x = Math.max(0, -Math.sin(ph + 1)) * a;
      body.position.y = 4.1 + Math.abs(Math.sin(ph)) * 0.15 * clamp(speed / 3, 0, 1);
      const stepPhase = Math.floor(ph / Math.PI);
      if (speed > 0.4 && stepPhase !== lastStep) { lastStep = stepPhase; if (g.userData.stepCb) g.userData.stepCb(); }
      tail.rotation.y = Math.sin(ph * 0.5) * 0.12; tail2.rotation.y = Math.sin(ph * 0.5 - 0.6) * 0.16;
      neck.rotation.x = damp(neck.rotation.x, st.roar ? -0.5 : st.sniff ? 0.35 : st.lunge ? 0.3 : 0, 4, dt);
      neck.rotation.y = damp(neck.rotation.y, st.look ?? 0, 3, dt);
      jaw.rotation.x = damp(jaw.rotation.x, st.roar ? 0.75 : st.open ? 0.45 : 0.02, st.roar ? 6 : 8, dt);
    },
  };
  return bakeRig(g);
}

// ---------- EVA-0 ----------
function makeEva() {
  const M = mat('#c9c3b6', { rough: 0.45 }), MD = mat('#9d978b'), MC = mat('#2b2622', { rough: 0.3 });
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 2.6; g.add(body);
  mesh(G.sphere(1, 10, 8), M, { parent: body, scale: [1.0, 1.1, 2.4] });
  const tail = new THREE.Group(); tail.position.set(0, 0, -2.2); body.add(tail);
  mesh(G.cone(0.6, 4.2, 7), M, { parent: tail, rot: [-Math.PI / 2, 0, 0], pos: [0, 0, -2] });
  const neck = new THREE.Group(); neck.position.set(0, 0.2, 2.1); body.add(neck);
  mesh(G.cyl(0.4, 0.6, 1.8, 7), M, { parent: neck, rot: [1.35, 0, 0], pos: [0, -0.1, 0.8] });
  const head = new THREE.Group(); head.position.set(0, -0.4, 1.8); neck.add(head);
  mesh(G.box(0.7, 0.55, 1.5), M, { parent: head, pos: [0, 0, 0.5] });
  for (const sx of [-1, 1]) mesh(G.sphere(0.08, 6, 4), mat('#8f9aa0', { rough: 0.2 }), { parent: head, pos: [sx * 0.34, 0.14, 0.5], cast: false });
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * 0.8, -0.2, 1.6); body.add(arm);
    mesh(G.cyl(0.14, 0.2, 1.6, 6), MD, { parent: arm, pos: [0, -0.7, 0.2], rot: [0.3, 0, 0] });
    for (let k = 0; k < 3; k++) mesh(G.cone(0.05, 0.9, 4), MC, { parent: arm, pos: [(k - 1) * 0.08, -1.6, 0.4], rot: [0.9, 0, 0] });
    arms.push(arm);
  }
  const legs = [limb(g, -0.8, 2.4, -0.4, 2.4, 0.4, M), limb(g, 0.8, 2.4, -0.4, 2.4, 0.4, M)];
  let ph = 0;
  g.userData = {
    kind: 'eva', head, neck, body,
    anim(dt, speed, st = {}) {
      ph += dt * (0.8 + speed * 0.9);
      const a = clamp(speed / 4, 0, 1) * 0.5;
      legs[0].pivot.rotation.x = Math.sin(ph) * a; legs[1].pivot.rotation.x = -Math.sin(ph) * a;
      arms[0].rotation.x = Math.sin(ph) * 0.2 - 0.2; arms[1].rotation.x = -Math.sin(ph) * 0.2 - 0.2;
      neck.rotation.y = damp(neck.rotation.y, st.look ?? Math.sin(Game.time * 0.7) * 0.4, 2, dt);
      neck.rotation.x = damp(neck.rotation.x, st.drink ? 0.6 : st.listen ? -0.25 : 0, 2, dt);
      body.position.y = st.sleep ? 1.3 : 2.6;
    },
  };
  return bakeRig(g);
}

// humans: see 26-people.js (makeHuman) and 27-cast.js (characters, NPCs, companions)
