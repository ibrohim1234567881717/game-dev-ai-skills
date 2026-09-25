// ============================================================
// 28-heli.js — the expedition helicopter: model, engine, rotor, audio
//
// Engine model: rpm eases toward a target (spool-up ~7 s, spin-down ~20 s).
// Blades are drawn while slow; above ~70 % a translucent blur disc takes
// over, which is how a fast rotor reads on camera (no strobing).
// The engine is a positional Sound.emitter: loudness and brightness fall
// off with distance, and it is stopped when the rotor stops or the world
// is torn down.
// ============================================================

// superellipse loft along Z: sections [z, cy, halfW, halfH, n]; optional angle range for patches (glass)
function loftGeo(sections, seg = 20, a0 = 0, a1 = TAU, cap = true) {
  const pos = [], idx = [];
  const full = a1 - a0 >= TAU - 1e-6;
  const cols = full ? seg : seg + 1;
  for (const [z, cy, w, h, n = 2.4] of sections) {
    for (let k = 0; k < cols; k++) {
      const a = a0 + (a1 - a0) * (k / seg);
      const ca = Math.cos(a), sa = Math.sin(a);
      pos.push(w * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n), cy + h * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n), z);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const k2 = full ? (k + 1) % seg : k + 1;
      const a = i * cols + k, b = i * cols + k2, c = (i + 1) * cols + k, d = (i + 1) * cols + k2;
      idx.push(a, c, b, b, c, d);
    }
  }
  if (cap && full) {
    for (const [si, flip] of [[0, true], [sections.length - 1, false]]) {
      const [z, cy] = sections[si];
      const ci = pos.length / 3; pos.push(0, cy, z);
      for (let k = 0; k < seg; k++) { const a = si * cols + k, b = si * cols + (k + 1) % seg; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let _blurTex = null;
function rotorBlurTexture() {
  if (_blurTex) return _blurTex;
  _blurTex = canvasTex(256, 256, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * TAU;
      const gr = g.createRadialGradient(cx, cy, 8, cx, cy, w / 2);
      gr.addColorStop(0, 'rgba(20,22,22,0.0)'); gr.addColorStop(0.15, 'rgba(20,22,22,0.55)'); gr.addColorStop(0.9, 'rgba(20,22,22,0.35)'); gr.addColorStop(1, 'rgba(20,22,22,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, w / 2, a0, a0 + 0.9); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(20,22,22,0.12)'; g.beginPath(); g.arc(cx, cy, w / 2 - 2, 0, TAU); g.fill();
  });
  return _blurTex;
}

function makeHelicopter(o = {}) {
  const g = new THREE.Group(); g.name = 'heli';
  const body = new THREE.Group(); g.add(body);
  const paint = new THREE.MeshStandardMaterial({ color: o.color || '#3a4640', roughness: 0.48, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1c1f1e', roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: '#16222a', roughness: 0.06, metalness: 0.7, transparent: true, opacity: o.wreck ? 0.5 : 0.62, side: THREE.DoubleSide });
  const stripe = new THREE.MeshStandardMaterial({ color: o.stripe || '#c8642a', roughness: 0.5, metalness: 0.2 });
  const inner = new THREE.MeshStandardMaterial({ color: '#2a2e2c', roughness: 0.85 });
  const secs = [[3.95, 1.5, 0.08, 0.1, 2], [3.7, 1.48, 0.5, 0.55, 2.2], [3.1, 1.56, 0.95, 0.95, 2.4], [2.1, 1.7, 1.2, 1.12, 2.8], [0.5, 1.75, 1.26, 1.18, 3.2], [-1.4, 1.75, 1.22, 1.14, 3.0], [-2.5, 1.92, 0.86, 0.88, 2.6], [-3.4, 2.1, 0.44, 0.48, 2.2]];
  const hull = new THREE.Mesh(loftGeo(secs, 28), paint); hull.castShadow = true; hull.receiveShadow = true; body.add(hull);
  // cockpit glass: a patch over the upper front, slightly proud of the hull
  const gsecs = [[3.82, 1.5, 0.36, 0.42, 2.2], [3.5, 1.5, 0.66, 0.72, 2.3], [3.0, 1.57, 0.99, 0.99, 2.4], [2.35, 1.66, 1.18, 1.12, 2.7]].map(([z, cy, w, h, n]) => [z, cy, w + 0.02, h + 0.02, n]);
  body.add(new THREE.Mesh(loftGeo(gsecs, 20, -0.35, Math.PI + 0.35, false), glass));
  // cabin windows and the sliding door (right side, +X)
  for (const s of [1, -1]) {
    for (const [z, len] of [[1.35, 0.9], [-0.25, 0.9]]) mesh(G.box(0.03, 0.62, len), glass, { parent: body, pos: [s * 1.245, 2.02, z], cast: false });
    mesh(G.box(0.02, 0.1, 5.2), stripe, { parent: body, pos: [s * 1.262, 1.32, 0.3], cast: false });
  }
  const door = new THREE.Group(); body.add(door);
  mesh(G.box(0.05, 1.5, 1.7), paint, { parent: door, pos: [1.27, 1.62, 0.55] });
  mesh(G.box(0.02, 0.55, 0.8), glass, { parent: door, pos: [1.3, 2.02, 0.55], cast: false });
  mesh(G.box(0.02, 0.1, 1.7), stripe, { parent: door, pos: [1.3, 1.32, 0.55], cast: false });
  // markings: D-05 on both sides of the boom
  const mark = canvasTex(256, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#e8e6de'; c.font = 'bold 44px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillText(o.label || 'D-05', w / 2, 46); });
  for (const s of [1, -1]) mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: mark, transparent: true, roughness: 0.6, depthWrite: false }), { parent: body, pos: [s * 0.36, 2.2, -4.6], rot: [0, s * Math.PI / 2, 0], cast: false });
  // tail boom, fin, stabiliser
  mesh(G.cyl(0.2, 0.42, 5.4, 12), paint, { parent: body, pos: [0, 2.22, -5.9], rot: [Math.PI / 2 + 0.05, 0, 0] });
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(-0.9, 0); fin.lineTo(-1.4, 1.6); fin.lineTo(-0.7, 1.6); fin.lineTo(0, 0.3);
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: false }); finGeo.rotateY(Math.PI / 2); finGeo.translate(-0.05, 2.25, -8.1);
  body.add(new THREE.Mesh(finGeo, paint));
  mesh(G.box(2.3, 0.06, 0.55), paint, { parent: body, pos: [0, 2.28, -7.3] });
  // engine cowling & exhausts
  const cowl = new THREE.Mesh(loftGeo([[1.3, 2.78, 0.2, 0.12, 2], [0.9, 2.82, 0.55, 0.3, 2.6], [-1.6, 2.82, 0.58, 0.32, 2.6], [-2.6, 2.6, 0.35, 0.22, 2.4]], 18), paint);
  cowl.castShadow = true; body.add(cowl);
  for (const s of [1, -1]) mesh(G.cyl(0.13, 0.16, 0.5, 10), dark, { parent: body, pos: [s * 0.32, 2.85, -2.3], rot: [Math.PI / 2 - 0.3, 0, 0] });
  // skids
  for (const s of [1, -1]) {
    mesh(G.cyl(0.06, 0.06, 4.8, 8), dark, { parent: body, pos: [s * 1.25, 0.08, 0.2], rot: [Math.PI / 2, 0, 0] });
    mesh(G.cyl(0.06, 0.06, 0.6, 8), dark, { parent: body, pos: [s * 1.25, 0.2, 2.78], rot: [Math.PI / 2 - 0.7, 0, 0] });
    for (const z of [1.3, -0.9]) mesh(G.cyl(0.05, 0.05, 1.0, 8), dark, { parent: body, pos: [s * 1.05, 0.5, z], rot: [0, 0, s * 0.45] });
  }
  // interior: floor, seats, instrument panel with lit screens
  const cabin = new THREE.Group(); body.add(cabin);
  mesh(G.box(2.2, 0.06, 4.6), inner, { parent: cabin, pos: [0, 0.9, 0.5], cast: false, receive: true });
  const seatM = new THREE.MeshStandardMaterial({ color: '#3a3f3b', roughness: 0.9 });
  const seats = [
    { x: 0.45, z: 2.25, ry: 0 }, { x: -0.45, z: 2.25, ry: 0 },
    { x: 0.82, z: 0.85, ry: -Math.PI / 2 }, { x: 0.82, z: -0.3, ry: -Math.PI / 2 }, { x: -0.82, z: 0.85, ry: Math.PI / 2 }, { x: -0.82, z: -0.3, ry: Math.PI / 2 },
  ];
  seats.forEach((s) => {
    const sg = new THREE.Group(); sg.position.set(s.x, 0.93, s.z); sg.rotation.y = s.ry; cabin.add(sg);
    mesh(G.box(0.5, 0.1, 0.5), seatM, { parent: sg, pos: [0, 0.42, 0], cast: false });
    mesh(G.box(0.5, 0.7, 0.08), seatM, { parent: sg, pos: [0, 0.8, -0.26], cast: false });
    s.y = 0.93 + 0.47; // seat surface, heli-local
  });
  const innerM = new THREE.MeshStandardMaterial({ color: '#343a37', roughness: 0.9, side: THREE.DoubleSide });
  const panel = (x, y, z, w, h, d) => mesh(G.box(w, h, d), innerM, { parent: cabin, pos: [x, y, z], cast: false });
  for (const s of [1, -1]) {
    const spans = s > 0 ? [[-1.6, -0.3], [1.45, 2.0]] : [[-1.6, 2.0]]; // right side leaves the door opening free
    for (const [z0, z1] of spans) { panel(s * 1.16, 1.3, (z0 + z1) / 2, 0.04, 0.8, z1 - z0); panel(s * 1.16, 2.6, (z0 + z1) / 2, 0.04, 0.42, z1 - z0); }
    for (const z of [-0.85, 0.55, 1.95]) if (s < 0 || z < -0.3 || z > 1.4) panel(s * 1.16, 2.02, z, 0.04, 0.66, 0.16);
  }
  panel(0, 2.84, 0.3, 2.3, 0.04, 4.3);
  panel(0, 1.86, -1.72, 2.3, 1.9, 0.04);
  const panelM = new THREE.MeshStandardMaterial({ color: '#141716', roughness: 0.7 });
  mesh(G.box(1.5, 0.35, 0.25), panelM, { parent: cabin, pos: [0, 1.62, 2.95], rot: [-0.4, 0, 0], cast: false });
  const screenM = new THREE.MeshBasicMaterial({ color: '#4fb8d8', toneMapped: false });
  for (const x of [-0.45, -0.15, 0.15, 0.45]) mesh(G.box(0.22, 0.14, 0.01), screenM, { parent: cabin, pos: [x, 1.7, 2.84], rot: [-0.4, 0, 0], cast: false });
  const cabinLight = new THREE.PointLight('#ffb070', 0, 5, 2); cabinLight.position.set(0, 2.2, 0.4); cabin.add(cabinLight);
  // rotor
  const rotor = new THREE.Group(); rotor.position.set(0, 3.25, 0.1); g.add(rotor);
  mesh(G.cyl(0.14, 0.2, 0.55, 10), dark, { parent: rotor, pos: [0, -0.1, 0] });
  mesh(G.cyl(0.26, 0.26, 0.16, 12), dark, { parent: rotor, pos: [0, 0.16, 0] });
  const blades = new THREE.Group(); rotor.add(blades);
  for (let i = 0; i < 4; i++) { const b = mesh(G.box(0.34, 0.045, 7.0), dark, { parent: blades, rot: [0, (i / 4) * Math.PI, 0], pos: [0, 0.18, 0] }); b.geometry.translate(0, 0, 0); }
  const blurM = new THREE.MeshBasicMaterial({ map: rotorBlurTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const disc = mesh(new THREE.CircleGeometry(7.1, 48), blurM, { parent: rotor, pos: [0, 0.19, 0], rot: [-Math.PI / 2, 0, 0], cast: false });
  const tail = new THREE.Group(); tail.position.set(0.2, 2.95, -8.05); g.add(tail);
  const tblades = new THREE.Group(); tail.add(tblades);
  for (let i = 0; i < 2; i++) mesh(G.box(0.04, 1.7, 0.15), dark, { parent: tblades, rot: [(i / 2) * Math.PI, 0, 0] });
  const tdiscM = blurM.clone(); tdiscM.opacity = 0;
  const tdisc = mesh(new THREE.CircleGeometry(0.86, 24), tdiscM, { parent: tail, rot: [0, Math.PI / 2, 0], cast: false });
  // lights
  const navR = mesh(G.sphere(0.07, 8, 6), mat('#ff3030', { emissive: '#ff2020', ei: 3 }), { parent: body, pos: [-1.28, 1.55, 1.9], cast: false });
  const navG = mesh(G.sphere(0.07, 8, 6), mat('#30ff60', { emissive: '#20ff40', ei: 3 }), { parent: body, pos: [1.28, 1.55, 1.9], cast: false });
  const beacon = mesh(G.sphere(0.09, 8, 6), mat('#ff3a2a', { emissive: '#ff2a1a', ei: 4 }), { parent: body, pos: [0, 3.0, -2.2], cast: false });
  if (o.wreck) { disc.visible = false; tdisc.visible = false; }

  const E = { rpm: o.rpm ?? 0, target: o.rpm ?? 0, t: rnd(0, 10), emitter: null, doorOpen: 0, doorTarget: 0 };
  g.userData = {
    body, rotor, tail, blades, disc, door, cabin, cabinLight, seats, engine: E, navR, navG, beacon,
    start() { E.target = 1; },
    stop() { E.target = 0; },
    idle() { E.target = 0.62; },
    setRpm(r) { E.rpm = E.target = r; },
    openDoor(open = true) { E.doorTarget = open ? 1 : 0; },
    // seat a character: g.userData.seat(npcGroup, seatIndex)
    seat(npc, i) {
      const s = seats[i];
      cabin.add(npc);
      npc.position.set(s.x, s.y - 0.4 * (npc.userData.height || 1.78) / 1.78, s.z);
      npc.rotation.set(0, s.ry, 0);
      npc.userData.pose = { sit: true };
      npc.userData.seated = true;
    },
    update(dt, legacy) {
      if (typeof legacy === 'number' && !E.managed) E.target = legacy;
      const up = E.target > E.rpm;
      E.rpm = damp(E.rpm, E.target, up ? 0.45 : 0.16, dt);
      if (Math.abs(E.rpm - E.target) < 0.004) E.rpm = E.target;
      E.t += dt;
      const r = E.rpm;
      rotor.rotation.y += dt * r * 30;
      tblades.rotation.x += dt * r * 140;
      tdisc.rotation.x = 0;
      const blur = smoothstep(0.4, 0.78, r);
      blades.visible = r < 0.8;
      blurM.opacity = blur * 0.5; disc.rotation.z += dt * r * 3;
      tdiscM.opacity = smoothstep(0.3, 0.6, r) * 0.45;
      tblades.visible = r < 0.55;
      body.position.y = Math.sin(E.t * 41) * 0.006 * r * (o.onGround === false ? 0.3 : 1);
      body.position.x = Math.sin(E.t * 37 + 1) * 0.003 * r;
      E.doorOpen = damp(E.doorOpen, E.doorTarget, 3, dt);
      door.position.z = -E.doorOpen * 1.55; door.position.x = E.doorOpen * 0.08;
      const blink = (Game.time % 1.2) < 0.12;
      beacon.visible = r > 0.05 ? blink : false;
      navR.visible = navG.visible = !o.wreck;
      // positional engine sound
      if (!o.silent && Sound.ctx) {
        if (r > 0.02 && !E.emitter) E.emitter = Sound.emitter('heli', { ref: 9, rolloff: 1.15, gain: 1.1, rate: r });
        if (E.emitter) {
          g.getWorldPosition(_heliV); _heliV.y += 2.6;
          E.emitter.setPos(_heliV); E.emitter.setRate(r);
          if (r <= 0.02 && E.target === 0) { E.emitter.stop(1.5); E.emitter = null; }
        }
      }
    },
    dispose() { if (E.emitter) { E.emitter.stop(0.3); E.emitter = null; } },
  };
  return bakeRig(g);
}
const _heliV = new THREE.Vector3();
