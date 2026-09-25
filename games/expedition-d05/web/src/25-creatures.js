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
const LOD_K = () => [0.65, 0.85, 1][GFX.level];
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
    const col = c.material.color || new THREE.Color('#888888'), n = g.attributes.position.count, C = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { C[i * 3] = col.r; C[i * 3 + 1] = col.g; C[i * 3 + 2] = col.b; }
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

// ---------- Triceratops ----------
function makeTriceratops(o = {}) {
  const skin = o.skin || '#6d6a4f', belly = o.belly || '#8a8466', frillC = o.frill || '#8a4b2c';
  const M = mat(skin), MB = mat(belly), MF = mat(frillC), MH = mat('#d9cfb3', { rough: 0.6 });
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 1.78; g.add(body);
  mesh(G.sphere(1, 12, 9), M, { parent: body, scale: [1.6, 1.3, 2.8] });
  mesh(G.sphere(1, 10, 7), M, { parent: body, pos: [0, 0.35, -0.6], scale: [1.35, 1.0, 1.8] });
  mesh(G.sphere(1, 10, 7), MB, { parent: body, pos: [0, -0.45, 0.1], scale: [1.35, 0.8, 2.5] });
  // tail
  const tail = new THREE.Group(); tail.position.set(0, 0.1, -2.6); body.add(tail);
  mesh(G.cone(0.75, 3.2, 7), M, { parent: tail, rot: [-Math.PI / 2 - 0.12, 0, 0], pos: [0, -0.15, -1.4] });
  // head
  const neck = new THREE.Group(); neck.position.set(0, -0.05, 2.5); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, -0.05, 0.5); neck.add(head);
  mesh(G.sphere(1, 10, 8), M, { parent: head, pos: [0, 0, 0.7], scale: [0.85, 0.85, 1.25] });
  mesh(G.cone(0.42, 1.0, 6), M, { parent: head, rot: [Math.PI / 2 + 0.5, 0, 0], pos: [0, -0.3, 1.85] });
  const frill = mesh(G.cyl(1.75, 1.75, 0.16, 16, 1), MF, { parent: head, rot: [Math.PI / 2 - 0.55, 0, 0], pos: [0, 0.75, -0.05], scale: [1, 1, 0.95] });
  for (let i = 0; i < 9; i++) { const a = -1.25 + (i / 8) * 2.5; mesh(G.cone(0.14, 0.4, 5), MH, { parent: frill, pos: [Math.sin(a) * 1.75, 0, Math.cos(a) * 1.75 * -1 + 0.0], rot: [Math.PI / 2, 0, -a], cast: false }); }
  const hornL = mesh(G.cone(0.2, 1.35, 7), MH, { parent: head, rot: [1.05, 0, 0.12], pos: [-0.42, 0.62, 1.05] });
  const hornR = mesh(G.cone(0.2, 1.35, 7), MH, { parent: head, rot: [1.05, 0, -0.12], pos: [0.42, 0.62, 1.05] });
  mesh(G.cone(0.14, 0.5, 6), MH, { parent: head, rot: [1.0, 0, 0], pos: [0, 0.2, 1.72] });
  if (o.broken) { hornL.scale.set(1, 0.38, 1); hornL.position.y -= 0.1; }
  mesh(G.sphere(0.09, 6, 4), mat('#120e08', { rough: 0.3 }), { parent: head, pos: [0.62, 0.3, 1.0], cast: false });
  mesh(G.sphere(0.09, 6, 4), mat('#120e08', { rough: 0.3 }), { parent: head, pos: [-0.62, 0.3, 1.0], cast: false });
  // legs
  const legs = [
    limb(g, -1.05, 1.45, 1.7, 1.5, 0.47, M, { taper: 0.9 }), limb(g, 1.05, 1.45, 1.7, 1.5, 0.47, M, { taper: 0.9 }),
    limb(g, -1.12, 1.55, -1.5, 1.6, 0.55, M, { taper: 0.9 }), limb(g, 1.12, 1.55, -1.5, 1.6, 0.55, M, { taper: 0.9 }),
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
      tail.rotation.y = Math.sin(ph * 0.5) * 0.18;
      const headDown = st.graze ? 0.62 : st.alert ? -0.28 : st.charge ? 0.35 : 0.05;
      neck.rotation.x = damp(neck.rotation.x, headDown + Math.sin(Game.time * 1.3 + ph) * 0.03, 3, dt);
      neck.rotation.y = damp(neck.rotation.y, st.look ?? 0, 3, dt);
    },
  };
  return rigLOD(bakeRig(g), 105 * LOD_K());
}

// ---------- Brachiosaurus ----------
function makeBrachio() {
  const M = mat('#6f7a6a'), MB = mat('#8d9585');
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 6; g.add(body);
  mesh(G.sphere(1, 12, 9), M, { parent: body, scale: [2.3, 2.3, 4.6] });
  mesh(G.sphere(1, 10, 7), MB, { parent: body, pos: [0, -1, 0], scale: [2, 1.4, 4] });
  mesh(G.cone(1.1, 9, 8), M, { parent: body, rot: [-Math.PI / 2 - 0.25, 0, 0], pos: [0, -1.1, -7.5] });
  const neck = new THREE.Group(); neck.position.set(0, 1.4, 3.6); body.add(neck);
  const segs = [];
  let parent = neck;
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Group(); s.position.set(0, i === 0 ? 0 : 2.1, 0); parent.add(s);
    mesh(G.cyl(0.62 - i * 0.07, 0.8 - i * 0.07, 2.3, 8), M, { parent: s, pos: [0, 1.05, 0] });
    s.rotation.x = i === 0 ? -0.35 : -0.03;
    segs.push(s); parent = s;
  }
  const head = new THREE.Group(); head.position.set(0, 2.2, 0.2); parent.add(head);
  mesh(G.box(0.8, 0.75, 1.5), M, { parent: head, pos: [0, 0.2, 0.5] });
  mesh(G.box(0.5, 0.5, 0.5), M, { parent: head, pos: [0, 0.55, 0.1] });
  const legs = [[-1.6, 5.2, 2.6, 5.4], [1.6, 5.2, 2.6, 5.4], [-1.6, 5.0, -2.8, 5], [1.6, 5.0, -2.8, 5]].map(([x, y, z, l]) => limb(g, x, y, z, l, 0.75, M));
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
  const skin = o.skin || '#5a5a48', M = mat(skin), MS = mat(o.stripe || '#3a3b30'), MF = mat('#2c2a24'), MC = mat('#d8d0bb', { rough: 0.5 });
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 1.15; g.add(body);
  mesh(G.sphere(1, 10, 8), M, { parent: body, scale: [0.42, 0.45, 0.95] });
  mesh(G.sphere(1, 8, 6), MS, { parent: body, pos: [0, 0.2, -0.1], scale: [0.3, 0.3, 0.8] });
  const tail = new THREE.Group(); tail.position.set(0, 0.05, -0.85); body.add(tail);
  mesh(G.cone(0.26, 2.2, 6), M, { parent: tail, rot: [-Math.PI / 2, 0, 0], pos: [0, 0, -1.0] });
  const plume = mesh(G.cone(0.2, 0.6, 5), MF, { parent: tail, rot: [-Math.PI / 2, 0, 0], pos: [0, 0.05, -2.1] });
  const neck = new THREE.Group(); neck.position.set(0, 0.25, 0.8); body.add(neck);
  mesh(G.cyl(0.14, 0.2, 0.65, 6), M, { parent: neck, rot: [0.9, 0, 0], pos: [0, 0.18, 0.18] });
  const head = new THREE.Group(); head.position.set(0, 0.42, 0.42); neck.add(head);
  mesh(G.box(0.26, 0.26, 0.52), M, { parent: head, pos: [0, 0, 0.12] });
  const jaw = new THREE.Group(); jaw.position.set(0, -0.08, 0); head.add(jaw);
  mesh(G.box(0.2, 0.08, 0.45), M, { parent: jaw, pos: [0, -0.04, 0.2] });
  mesh(G.box(0.16, 0.14, 0.36), M, { parent: head, pos: [0, 0.02, 0.48] });
  const crest = mesh(G.box(0.05, 0.16, 0.4), MF, { parent: head, pos: [0, 0.2, -0.05] });
  if (o.notch) crest.scale.set(1, 1, 0.55);
  for (const sx of [-1, 1]) mesh(G.sphere(0.035, 5, 4), mat('#d9a520', { emissive: '#8a5a00', ei: 0.6 }), { parent: head, pos: [sx * 0.13, 0.06, 0.22], cast: false });
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * 0.3, -0.05, 0.55); body.add(arm);
    mesh(G.box(0.07, 0.35, 0.07), M, { parent: arm, pos: [0, -0.15, 0.05], rot: [0.6, 0, 0] });
    mesh(G.box(0.02, 0.2, 0.22), MF, { parent: arm, pos: [0, -0.18, -0.06] });
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.26, 1.1, -0.15); g.add(hip);
    mesh(G.cyl(0.13, 0.18, 0.6, 6), M, { parent: hip, pos: [0, -0.25, 0.05], rot: [-0.3, 0, 0] });
    const knee = new THREE.Group(); knee.position.set(0, -0.52, 0.15); hip.add(knee);
    mesh(G.cyl(0.07, 0.09, 0.62, 6), M, { parent: knee, pos: [0, -0.28, -0.1], rot: [0.45, 0, 0] });
    mesh(G.box(0.1, 0.06, 0.3), M, { parent: knee, pos: [0, -0.56, 0.02] });
    mesh(G.cone(0.03, 0.18, 4), MC, { parent: knee, pos: [0.03 * sx, -0.47, 0.15], rot: [-0.9, 0, 0] });
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
  const M = mat('#6a766a'), MB = mat('#9aa090'), MS = new THREE.MeshStandardMaterial({ color: '#b04a34', roughness: 0.55, side: THREE.DoubleSide, emissive: new THREE.Color('#5a1a0e'), emissiveIntensity: 0.9, flatShading: true });
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 3.2; g.add(body);
  mesh(G.sphere(1, 12, 9), M, { parent: body, scale: [1.5, 1.5, 4.2] });
  mesh(G.sphere(1, 10, 7), MB, { parent: body, pos: [0, -0.6, 0.3], scale: [1.3, 0.9, 3.4] });
  // sail
  const sailShape = new THREE.Shape();
  sailShape.moveTo(-3.6, 0);
  for (let i = 0; i <= 12; i++) { const t = i / 12; sailShape.lineTo(-3.6 + t * 7.2, Math.sin(t * Math.PI) * 4.2 * (0.85 + 0.15 * Math.sin(t * 17))); }
  sailShape.lineTo(3.6, 0); sailShape.lineTo(-3.6, 0);
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), MS);
  sail.rotation.y = Math.PI / 2; sail.position.set(0, 1.1, 0);
  sail.castShadow = true; body.add(sail);
  // scar notch on the sail (Charon)
  mesh(G.box(0.06, 1.1, 0.35), mat('#2a1a14'), { parent: body, pos: [0.02, 4.1, -0.7], rot: [0.3, 0, 0], cast: false });
  const tail = new THREE.Group(); tail.position.set(0, 0, -3.9); body.add(tail);
  mesh(G.cone(1.0, 6.5, 7), M, { parent: tail, rot: [-Math.PI / 2, 0, 0], pos: [0, 0, -3] });
  mesh(G.box(0.12, 1.6, 4.5), MS, { parent: tail, pos: [0, 0.6, -3.2], cast: false });
  const neck = new THREE.Group(); neck.position.set(0, 0.6, 3.9); body.add(neck);
  mesh(G.cyl(0.7, 0.95, 2.4, 8), M, { parent: neck, rot: [1.1, 0, 0], pos: [0, 0.4, 0.9] });
  const head = new THREE.Group(); head.position.set(0, 0.9, 2.1); neck.add(head);
  mesh(G.box(0.8, 0.7, 1.6), M, { parent: head, pos: [0, 0.1, 0.2] });
  mesh(G.box(0.5, 0.42, 2.4), M, { parent: head, pos: [0, 0, 2.0] });
  const jaw = new THREE.Group(); jaw.position.set(0, -0.2, 0.6); head.add(jaw);
  mesh(G.box(0.46, 0.2, 3.0), MB, { parent: jaw, pos: [0, -0.1, 1.2] });
  for (const sx of [-1, 1]) mesh(G.sphere(0.07, 5, 4), mat('#e8c24a', { emissive: '#704a00' }), { parent: head, pos: [sx * 0.4, 0.3, 0.6], cast: false });
  const legs = [limb(g, -1.2, 3.0, -1.4, 3.1, 0.55, M), limb(g, 1.2, 3.0, -1.4, 3.1, 0.55, M)];
  const arms = [limb(g, -1.0, 2.7, 2.6, 2.0, 0.28, M), limb(g, 1.0, 2.7, 2.6, 2.0, 0.28, M)];
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
function makeRex() {
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
