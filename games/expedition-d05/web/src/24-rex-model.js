// ============================================================
// 24-rex-model.js — the Queen from the author's Meshy model, skinned and animated bone by bone
//
// build.py embeds models/rex.json (prepared by models/prepare_rex.py) as window.MODEL_REX: the
// mesh, a skin of four influences per vertex, the 72-bone skeleton in its rest pose, and three
// small JPEG textures. makeRexSkinned() turns it into a SkinnedMesh behind the same contract as
// the procedural T-Rex in 25-creatures.js: a Group facing +Z with its origin on the ground,
// userData.anim(dt, speed, { roar, sniff, lunge, open, look }) and userData.stepCb. makeRex()
// uses it when the model is there and falls back to the procedural one when it is not.
//
// The model has no animation clips (Meshy's library does not cover a Smart Rig dinosaur), so
// every motion is made here from its bones: the gait, the head and neck, the jaw, the tail, the
// breathing. Rotations are given about the model's own axes (X across the body, Y up) and turned
// into each bone's local frame once, from the rest pose, so they do not depend on bone rolls.
// ============================================================
const REX_SCALE = 3.8; // the model is 1.7 m tall; the Queen stands about 6.5 m, near the procedural one
const REX_HIP_Z = -0.6; // where the procedural T-Rex has its hips: cutscenes and collisions are set up around it

const RexModel = {
  _base: undefined,
  // decoded once and shared: every Queen the game builds uses the same geometry and textures
  base() {
    if (this._base !== undefined) return this._base;
    this._base = null;
    const M = typeof window !== 'undefined' ? window.MODEL_REX : null;
    if (!M || M.v !== 1) return null;
    const bytes = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
    const f32 = (s) => new Float32Array(bytes(s).buffer);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(f32(M.position), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(f32(M.normal), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(f32(M.uv), 2));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(bytes(M.skinIndex), 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(bytes(M.skinWeight), 4, true));
    const ib = bytes(M.index).buffer;
    geo.setIndex(new THREE.BufferAttribute(M.index32 ? new Uint32Array(ib) : new Uint16Array(ib), 1));
    geo.computeBoundingSphere();
    const loader = new THREE.TextureLoader();
    const tex = (url, srgb) => {
      const t = loader.load(url);
      t.flipY = false; // glTF UVs
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    const material = new THREE.MeshStandardMaterial({
      map: tex(M.maps.map, true), normalMap: tex(M.maps.normalMap), roughnessMap: tex(M.maps.roughnessMap),
      roughness: 1, metalness: 0, envMapIntensity: 0.55,
      side: M.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
    // no tangents in the mesh: three derives them, and glTF's green channel then points the other way
    material.normalScale.set(1, -1);
    this._base = { M, geo, material, ibm: f32(M.ibm) };
    return this._base;
  },
};

// the bones this animation drives, by the names the Meshy rig gave them
const REX_BONES = {
  root: 'Bone_000',
  spine: ['Bone_008', 'Bone_007', 'Bone_006', 'Bone_005', 'Bone_004', 'Bone_003', 'Bone_002'],
  neck: ['Bone_043', 'Bone_042', 'Bone_041', 'Bone_040', 'Bone_039'],
  head: 'Bone_038',
  jaw: 'Bone_071',
  // thigh, shin, metatarsus, foot
  legs: [['Bone_013', 'Bone_012', 'Bone_011', 'Bone_010'], ['Bone_018', 'Bone_017', 'Bone_016', 'Bone_015']],
  arms: [['Bone_032', 'Bone_031'], ['Bone_037', 'Bone_036']],
  tail: ['Bone_027', 'Bone_026', 'Bone_025', 'Bone_024', 'Bone_023', 'Bone_022', 'Bone_021', 'Bone_020', 'Bone_019'],
};

function makeRexSkinned() {
  const B = RexModel.base();
  if (!B) return null;
  const { M } = B;
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  const bones = M.bones.map((b) => {
    const o = new THREE.Bone();
    o.name = b.name;
    o.position.fromArray(b.t); o.quaternion.fromArray(b.r); o.scale.fromArray(b.s);
    return o;
  });
  M.bones.forEach((b, i) => (b.parent >= 0 ? bones[b.parent] : rig).add(bones[i]));
  const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
  const need = [REX_BONES.root, REX_BONES.head, REX_BONES.jaw, ...REX_BONES.spine, ...REX_BONES.neck, ...REX_BONES.tail, ...REX_BONES.legs.flat(), ...REX_BONES.arms.flat()];
  const missing = need.filter((n) => !byName[n]);
  if (missing.length) { console.warn('UMBRA: the T-Rex model lacks bones', missing.join(', '), '- using the procedural one'); return null; }

  const mesh = new THREE.SkinnedMesh(B.geo, B.material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false; // the rest-pose bounds do not follow the animated bones
  rig.add(mesh);
  // bind while the rig is still at the origin and unscaled, as glTF's inverse bind matrices assume
  rig.updateMatrixWorld(true);
  const inverses = bones.map((_, i) => new THREE.Matrix4().fromArray(B.ibm, i * 16));
  mesh.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());

  const root = byName[REX_BONES.root];
  rig.scale.setScalar(REX_SCALE);
  rig.position.z = REX_HIP_Z - root.position.z * REX_SCALE;

  // rest pose, and the model's X (across) and Y (up) axes in each bone's local frame
  const rest = bones.map((b) => b.quaternion.clone());
  const axes = new Map();
  const qm = new THREE.Quaternion();
  for (const b of bones) {
    qm.identity();
    for (let n = b; n && n !== rig; n = n.parent) qm.premultiply(n.quaternion);
    const inv = qm.clone().invert();
    axes.set(b, { x: new THREE.Vector3(1, 0, 0).applyQuaternion(inv), y: new THREE.Vector3(0, 1, 0).applyQuaternion(inv) });
  }
  const _q = new THREE.Quaternion();
  const turn = (b, axis, ang) => { if (ang) b.quaternion.multiply(_q.setFromAxisAngle(axes.get(b)[axis], ang)); };
  const P = (n) => byName[n];
  const spine = REX_BONES.spine.map(P), neck = REX_BONES.neck.map(P), tail = REX_BONES.tail.map(P);
  const legs = REX_BONES.legs.map((l) => l.map(P)), arms = REX_BONES.arms.map((l) => l.map(P));
  const head = P(REX_BONES.head), jaw = P(REX_BONES.jaw);
  const rootY = root.position.y;

  let ph = 0, lastStep = 0, t = 0, pitch = 0, skull = 0, look = 0, jawV = 0.02;
  g.userData = {
    kind: 'rex', skinned: true, head, jaw, stepCb: null,
    anim(dt, speed, st = {}) {
      t += dt;
      // the same stride clock as the procedural T-Rex, so footstep sounds keep their timing
      ph += dt * (0.8 + speed * 0.32);
      const a = clamp(speed / 6, 0, 1) * 0.55;
      for (let i = 0; i < bones.length; i++) bones[i].quaternion.copy(rest[i]);
      // gait: each leg swings, and lifts its foot while it comes forward
      legs.forEach((L, i) => {
        const p = ph + i * Math.PI, swing = Math.sin(p), lift = Math.max(0, Math.cos(p));
        turn(L[0], 'x', -swing * a * 0.75);
        turn(L[1], 'x', lift * a * 0.95);
        turn(L[2], 'x', -lift * a * 0.8);
        turn(L[3], 'x', lift * a * 0.25);
      });
      const run = clamp(speed / 3, 0, 1);
      root.position.y = rootY + (Math.abs(Math.sin(ph)) * 0.15 * run - 0.05 * a) / REX_SCALE;
      turn(root, 'y', Math.sin(ph) * a * 0.08);
      const stepPhase = Math.floor(ph / Math.PI);
      if (speed > 0.4 && stepPhase !== lastStep) { lastStep = stepPhase; if (g.userData.stepCb) g.userData.stepCb(); }
      // breathing through the chest, a counter-swing through the spine as she walks
      const breath = Math.sin(t * (1.1 + run * 1.6));
      spine.forEach((b, i) => { turn(b, 'x', breath * 0.006); turn(b, 'y', -Math.sin(ph) * a * 0.03 * (i / spine.length)); });
      // the tail swings behind the stride, more toward the tip; it droops a little at rest
      tail.forEach((b, i) => {
        turn(b, 'y', Math.sin(ph * 0.5 - i * 0.45) * (0.025 + 0.011 * i) * (1 + speed * 0.08) + Math.sin(t * 0.37 - i * 0.3) * 0.012);
        turn(b, 'x', (0.006 - a * 0.012) * (i / tail.length) + Math.sin(t * 0.9 - i * 0.5) * 0.004);
      });
      // neck and head. A roar is thrown at the prey: the neck drops forward and the skull tips back
      // so the open jaws face ahead (the breach cutscene frames her mouth at about 4 m). Sniffing
      // and lunging lower the head, look turns it toward the player.
      pitch = damp(pitch, st.roar ? 0.42 : st.sniff ? 0.35 : st.lunge ? 0.3 : 0, st.roar ? 7 : 4, dt);
      skull = damp(skull, st.roar ? -0.34 : st.sniff ? 0.05 : 0, 5, dt);
      look = damp(look, st.look ?? 0, 3, dt);
      const nb = neck.length + 1;
      for (const b of neck) { turn(b, 'x', pitch / nb); turn(b, 'y', look / nb); }
      turn(head, 'x', pitch / nb + skull + Math.sin(t * 0.8) * 0.015 * (1 - run));
      turn(head, 'y', look / nb);
      // the model's rest pose has the mouth half open: 0.02 closes it, 0.45 is that rest, 0.75 a roar
      jawV = damp(jawV, st.roar ? 0.75 : st.open ? 0.45 : 0.02, st.roar ? 6 : 8, dt);
      turn(jaw, 'x', (jawV - 0.45) * 0.72);
      // the small arms hang and twitch with the stride
      arms.forEach((A, i) => { turn(A[0], 'x', Math.sin(ph + i) * a * 0.25 + breath * 0.01); turn(A[1], 'x', Math.sin(ph + i + 0.6) * a * 0.2); });
    },
  };
  g.userData.anim(0, 0);
  return g;
}
