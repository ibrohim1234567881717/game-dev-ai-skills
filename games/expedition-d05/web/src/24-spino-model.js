// ============================================================
// 24-spino-model.js — Charon from the author's Meshy spinosaurus, skinned and animated bone by bone
//
// build.py embeds models/spino.json (prepared by models/prepare_rex.py spinosaurus) as
// window.MODEL_SPINO. makeSpinoSkinned() builds a SkinnedMesh behind the same contract as the
// procedural spinosaurus in 25-creatures.js: a Group facing +Z with its origin on the ground,
// userData.anim(dt, speed, { open, up, lunge }). makeSpino() uses it when the model is there and
// falls back to the procedural one when it is not. Like the Queen's model it has no animation
// clips: the gait, the neck, the jaw and the tail are made here from its bones. The sail is part
// of the mesh, carried by the spine bones.
// ============================================================
const SPINO_SCALE = 3.8; // the model is 1.7 m tall with the sail; this puts its hips at 3.3 m, the procedural one's 3.2 m
const SPINO_BONES = {
  root: 'Bone_000',
  spine: ['Bone_001', 'Bone_005', 'Bone_004', 'Bone_003', 'Bone_002'],
  neck: ['Bone_027', 'Bone_026', 'Bone_025', 'Bone_024'],
  head: 'Bone_059',
  jaw: 'Bone_079', // the lower jaw, hinged behind the snout
  // thigh, shin, metatarsus, foot — the Meshy rig names them in no order, the skeleton was read bone by bone
  legs: [['Bone_010', 'Bone_009', 'Bone_008', 'Bone_007'], ['Bone_015', 'Bone_014', 'Bone_013', 'Bone_012']],
  arms: [['Bone_032', 'Bone_031', 'Bone_030'], ['Bone_037', 'Bone_036', 'Bone_035']],
  tail: ['Bone_023', 'Bone_022', 'Bone_021', 'Bone_020', 'Bone_019', 'Bone_018', 'Bone_017', 'Bone_016'],
};

const SpinoModel = {
  _base: undefined,
  base() {
    if (this._base === undefined) this._base = decodeMeshy(typeof window !== 'undefined' ? window.MODEL_SPINO : null);
    return this._base;
  },
};

function makeSpinoSkinned() {
  const B = SpinoModel.base();
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
  const need = [SPINO_BONES.root, SPINO_BONES.head, SPINO_BONES.jaw, ...SPINO_BONES.spine, ...SPINO_BONES.neck, ...SPINO_BONES.tail, ...SPINO_BONES.legs.flat(), ...SPINO_BONES.arms.flat()];
  const missing = need.filter((n) => !byName[n]);
  if (missing.length) { console.warn('UMBRA: the spinosaurus model lacks bones', missing.join(', '), '- using the procedural one'); return null; }

  const mesh = new THREE.SkinnedMesh(B.geo, B.material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false; // the rest-pose bounds do not follow the animated bones
  rig.add(mesh);
  rig.updateMatrixWorld(true);
  const inverses = bones.map((_, i) => new THREE.Matrix4().fromArray(B.ibm, i * 16));
  mesh.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());

  const root = byName[SPINO_BONES.root];
  rig.scale.setScalar(SPINO_SCALE);
  rig.position.z = -root.position.z * SPINO_SCALE; // the hips over the group's origin, as in the procedural model

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
  const spine = SPINO_BONES.spine.map(P), neck = SPINO_BONES.neck.map(P), tail = SPINO_BONES.tail.map(P);
  const legs = SPINO_BONES.legs.map((l) => l.map(P)), arms = SPINO_BONES.arms.map((l) => l.map(P));
  const head = P(SPINO_BONES.head), jaw = P(SPINO_BONES.jaw);
  const rootY = root.position.y;

  let ph = 0, t = 0, pitch = 0, jawV = 0;
  g.userData = {
    kind: 'spi', skinned: true, head, jaw, neck: neck[0], tail: tail[0], body: root,
    // where the jaws close, in the group's frame: the chapter measures the bite from here
    bite: new THREE.Vector3(0, 1.1 * SPINO_SCALE, 1.45 * SPINO_SCALE),
    anim(dt, speed, st = {}) {
      t += dt;
      ph += dt * (1 + speed * 0.6);
      const a = clamp(speed / 5, 0, 1) * 0.5;
      for (let i = 0; i < bones.length; i++) bones[i].quaternion.copy(rest[i]);
      // gait: the legs swing in turn, the shin folds back while the foot comes forward
      legs.forEach((L, i) => {
        const p = ph + i * Math.PI, swing = Math.sin(p), lift = Math.max(0, Math.cos(p));
        turn(L[0], 'x', -swing * a * 0.7);
        turn(L[1], 'x', lift * a * 0.9);
        turn(L[2], 'x', -lift * a * 0.75);
        turn(L[3], 'x', lift * a * 0.25);
      });
      const run = clamp(speed / 3, 0, 1);
      root.position.y = rootY + (Math.abs(Math.sin(ph)) * 0.1 * run) / SPINO_SCALE;
      const breath = Math.sin(t * 1.3);
      spine.forEach((b, i) => { turn(b, 'x', breath * 0.007); turn(b, 'y', -Math.sin(ph) * a * 0.04 * (i / spine.length)); });
      // a swimmer's tail: a slow sweep that grows toward the tip
      tail.forEach((b, i) => turn(b, 'y', Math.sin(ph * 0.5 + t * 0.4 - i * 0.5) * (0.05 + 0.014 * i)));
      // the neck: a lunge drops the head forward, `up` lifts it, as the procedural neck did
      pitch = damp(pitch, st.lunge ? 0.5 : st.up ? -0.4 : 0, 4, dt);
      const nb = neck.length + 1;
      for (const b of neck) turn(b, 'x', pitch / nb);
      turn(head, 'x', pitch / nb + Math.sin(t * 0.7) * 0.012);
      jawV = damp(jawV, st.open ? 0.55 : 0, 8, dt);
      turn(jaw, 'x', jawV);
      arms.forEach((A, i) => { turn(A[0], 'x', Math.sin(ph + i) * a * 0.3 + 0.1 + breath * 0.01); turn(A[1], 'x', Math.sin(ph + i + 0.6) * a * 0.2); });
    },
  };
  g.userData.anim(0, 0);
  return g;
}
