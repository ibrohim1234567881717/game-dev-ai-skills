// ============================================================
// 44-ch-k4.js — Chapter II: facility K-4, DNA 2 — Velociraptor
// ============================================================
function makeJeep(color = '#4c5540') {
  const g = new THREE.Group();
  mesh(G.box(1.9, 0.8, 4.0), mat(color), { parent: g, pos: [0, 0.9, 0] });
  mesh(G.box(1.8, 0.7, 1.6), mat(color), { parent: g, pos: [0, 1.6, -0.4] });
  mesh(G.box(1.7, 0.5, 0.05), mat('#1d2a30', { rough: 0.2, metal: 0.4 }), { parent: g, pos: [0, 1.7, 0.42], rot: [-0.3, 0, 0] });
  for (const [x, z] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) mesh(G.cyl(0.42, 0.42, 0.3, 10), mat('#1b1b19'), { parent: g, pos: [x, 0.42, z], rot: [0, 0, Math.PI / 2] });
  mesh(G.box(1.95, 0.08, 1.2), mat('#2a3322'), { parent: g, pos: [0, 1.32, 1.4], rot: [0.1, 0, 0] });
  return g;
}

CHAPTERS.k4 = {
  create() {
    const world = new World({ bounds: { x: 24, z: 38, r: 50 } });
    const inside = (x, z) => (x > 0 && x < 50 && z < 32) || (x > 46 && x < 50 && z < 36);
    const jH = (x, z) => (inside(x, z) ? 0 : smoothstep(34, 44, z) * (0.35 + fbm(x * 0.08, z * 0.08, 3) * 0.6));
    world.floor = (x, z) => (inside(x, z) ? 0 : jH(x, z));
    world.blocked = (x, z) => (z < 32.2 && (x < -0.2 || x > 50.2)) || (z < 36.2 && x > 50.2) || z < 0.2;
    world.snapY = true;
    world.scene.background = new THREE.Color('#050807');
    world.grade = { exposure: 1.08, contrast: 1.12, saturation: 0.95, lift: '#050404', gain: '#f0f4ee', bloom: 0.85, vignette: 1.2 };
    world.scene.fog = new THREE.Fog('#0b120e', 8, 60);
    const hemi = new THREE.HemisphereLight('#8fb0a0', '#26301f', 1.05); world.add(hemi); world.hemi = hemi; world.baseHemi = 1.05;
    const moon = new THREE.DirectionalLight('#b8c8d8', 1.5); moon.position.set(-30, 60, 80); world.add(moon);
    const flash = makeFlashlight(world, 34);
    // exterior terrain & jungle
    makeTerrain(world, { size: 140, seg: 80, cx: 25, cz: 64, height: (x, z) => (z < 36 ? -0.4 : jH(x, z)), color: (x, z, y, s, c) => { c.set('#2e3f24').lerp(_tmpC.set('#3d4a2a'), fbm(x * 0.1, z * 0.1, 2) * 0.5 + 0.5); if (Math.abs(x - 24) < 3 && z > 36) c.lerp(_tmpC.set('#4a4232'), 0.6); } });
    const outside = (x, z) => z > 37 && dist2d(x, z, 24, 38) < 56 && !(Math.abs(x - 24) < 4 && z < 76);
    const ferns = scatter(QUALITY ? 1400 : 700, () => { const x = rnd(-25, 75), z = rnd(37, 95); if (!outside(x, z)) return null; return { x, y: jH(x, z) - 0.05, z, s: rnd(1, 2.2), ry: rnd(0, TAU), tint: pick(['#4f7a38', '#5d8a40', '#3f6a30']) }; });
    makeFerns(world, ferns);
    scatterInstanced(world, treeFernGeo(), vegMat(0.01), scatter(QUALITY ? 90 : 50, () => { const x = rnd(-25, 75), z = rnd(38, 95); if (!outside(x, z)) return null; return { x, y: jH(x, z), z, s: rnd(1.1, 1.9), ry: rnd(0, TAU) }; }), { cast: false });
    scatterInstanced(world, coniferGeo(), vegMat(0.0025), scatter(QUALITY ? 120 : 70, () => { const x = rnd(-35, 85), z = rnd(40, 110); if (!outside(x, z) && z < 90) return null; return { x, y: jH(x, z), z, s: rnd(1.6, 2.6), ry: rnd(0, TAU) }; }), { cast: false });
    makeMotes(world, { color: '#cfe8b0', count: QUALITY ? 200 : 100, size: 0.07 });
    // building shell
    const wallM = mat('#3a3f3a', { rough: 0.95 }), cleanM = mat('#b9bfbb', { rough: 0.6 });
    mesh(G.box(50, 0.1, 36), mat('#2b2f2c', { rough: 0.8 }), { parent: world.scene, pos: [25, -0.04, 18], receive: true, cast: false });
    mesh(G.box(51, 0.3, 37), mat('#232624'), { parent: world.scene, pos: [25, 3.55, 18], cast: false });
    for (let i = 0; i < 14; i++) mesh(G.box(0.15, rnd(1, 3), 0.15), mat('#2f4a28'), { parent: world.scene, pos: [rnd(1, 46), 3.6 - rnd(0.3, 1), 32.1], rot: [0, 0, rnd(-0.3, 0.3)], cast: false });
    const segs = [
      [0, 0, 50, 0], [0, 0, 0, 32], [50, 0, 50, 36],
      [0, 18, 9, 18], [11, 18, 29, 18], [31, 18, 46, 18],
      [0, 22, 5, 22], [7, 22, 20, 22], [26, 22, 39, 22], [41, 22, 46, 22],
      [0, 32, 21, 32], [25, 32, 46, 32],
      [22, 0, 22, 18], [40, 0, 40, 8], [40, 11, 40, 18],
      [46, 0, 46, 3], [46, 5, 46, 18], [46, 18, 46, 19], [46, 21, 46, 22], [46, 22, 46, 36],
      [12, 22, 12, 32], [34, 22, 34, 32], [46, 36, 47, 36], [49, 36, 50, 36],
    ];
    buildWalls(world, segs, { mat: wallM });
    // clean room interior tint
    mesh(G.box(5.4, 3.3, 17.4), new THREE.MeshStandardMaterial({ color: '#c8cec9', roughness: 0.6, side: THREE.BackSide }), { parent: world.scene, pos: [43, 1.65, 9], cast: false, receive: true });
    world.ceiling = 3.35;
    // doors
    const gate = new Door(world, { x0: 21, z0: 32, x1: 25, z1: 32, color: '#51574f', stripe: true });
    const labDoor = new Door(world, { x0: 29, z0: 18, x1: 31, z1: 18, color: '#5c6a70', stripe: true });
    const blast = new Door(world, { x0: 40, z0: 8, x1: 40, z1: 11, color: '#6b6f66', stripe: true, speed: 14, open: true });
    const emerg = new Door(world, { x0: 46, z0: 3, x1: 46, z1: 5, color: '#4f6a52' });
    const side = new Door(world, { x0: 46, z0: 19, x1: 46, z1: 21, color: '#5a615c' });
    const exitD = new Door(world, { x0: 47, z0: 36, x1: 49, z1: 36, color: '#4f6a52', stripe: true });
    // red emergency lights
    const reds = [[11, 3.1, 9], [31, 3.1, 9], [43, 3.1, 9], [12, 3.1, 20], [35, 3.1, 20], [23, 3.1, 27], [6, 3.1, 27], [40, 3.1, 27], [48, 3.1, 8], [48, 3.1, 28]].map(([x, y, z]) => {
      const l = new THREE.PointLight('#ff2a1a', 0, 16, 1.6); l.position.set(x, y, z); world.add(l);
      mesh(G.box(0.4, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: '#3a0a08' }), { parent: world.scene, pos: [x, 3.3, z], cast: false });
      return l;
    });
    // props
    const table = (x, z, w = 2.4, d = 1) => { mesh(G.box(w, 0.9, d), mat('#4a4f4c', { metal: 0.3 }), { parent: world.scene, pos: [x, 0.45, z], receive: true }); world.boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, low: true }); };
    table(27, 6); table(34, 6); table(27, 13); table(35, 13, 3); table(15, 27, 3.4, 1.2); table(40, 29, 3, 1.2); table(3, 25.5, 1.4, 3);
    // generator
    const gen = new THREE.Group();
    mesh(G.box(3, 1.8, 1.8), mat('#5b5a3e', { metal: 0.3 }), { parent: gen, pos: [0, 0.9, 0] });
    mesh(G.cyl(0.5, 0.5, 2.8, 12), mat('#474a3a'), { parent: gen, pos: [0, 1.9, 0], rot: [0, 0, Math.PI / 2] });
    const genLamp = mesh(G.sphere(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#331111' }), { parent: gen, pos: [1.2, 1.9, 0.92], cast: false });
    gen.position.set(4, 0, 29); world.add(gen); world.circles.push({ x: 4, z: 29, r: 1.8 });
    // power panel in the hall
    const panel = new THREE.Group();
    mesh(G.box(1.2, 1.4, 0.2), mat('#3a3f42', { metal: 0.5 }), { parent: panel });
    const panelLeds = [0, 1, 2, 3].map((i) => mesh(G.sphere(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: '#222' }), { parent: panel, pos: [-0.36 + i * 0.24, 0.35, 0.12], cast: false }));
    panel.position.set(13.2, 1.5, 24.5); panel.rotation.y = Math.PI / 2; world.add(panel);
    // den: cages, straw, bones
    for (let i = 0; i < 18; i++) mesh(G.box(0.08, 3.2, 0.08), mat('#555'), { parent: world.scene, pos: [2 + i * 0.5, 1.6, 12], cast: false });
    for (let i = 0; i < 12; i++) mesh(G.box(rnd(0.8, 1.6), 0.25, rnd(0.8, 1.6)), mat('#6b5a38'), { parent: world.scene, pos: [rnd(3, 20), 0.12, rnd(2, 10)], rot: [0, rnd(0, TAU), 0], cast: false });
    for (let i = 0; i < 10; i++) mesh(G.cyl(0.05, 0.05, rnd(0.6, 1.2), 5), mat('#cdc5ae'), { parent: world.scene, pos: [rnd(3, 20), 0.06, rnd(3, 16)], rot: [Math.PI / 2, rnd(0, TAU), 0], cast: false });
    // incubators in the lab
    for (let i = 0; i < 4; i++) mesh(G.cyl(0.5, 0.5, 1.4, 12), new THREE.MeshStandardMaterial({ color: '#7fa6b0', transparent: true, opacity: 0.35, roughness: 0.1 }), { parent: world.scene, pos: [24 + i * 1.6, 0.7, 16.2], cast: false });
    // fridge
    const fridge = new THREE.Group();
    mesh(G.box(1.2, 2.1, 0.8), mat('#c9ccc4', { rough: 0.4 }), { parent: fridge, pos: [0, 1.05, 0] });
    const fridgeLight = mesh(G.box(0.8, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#3a6a90' }), { parent: fridge, pos: [0, 1.9, 0.42], cast: false });
    fridge.position.set(38.8, 0, 2.2); world.add(fridge); world.boxes.push({ x0: 38.2, x1: 39.4, z0: 1.8, z1: 2.6, low: true });
    // blueprint of the case (six slots)
    const bpTex = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#123a5c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#cfe6ff'; g.lineWidth = 2; g.strokeRect(40, 70, 430, 120);
      for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(85 + i * 68, 130, 20, 44, 0, 0, TAU); g.stroke(); }
      g.fillStyle = '#cfe6ff'; g.font = 'bold 22px Arial'; g.fillText('SAMPLE CASE — REV. 1986 — SLOTS: 6', 40, 45); g.font = 'italic 26px Georgia'; g.fillStyle = '#ffdca0'; g.fillText('«E.»', 425, 225);
    });
    mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: bpTex }), { parent: world.scene, pos: [30, 1.9, 0.18], cast: false });
    // security monitors
    const secTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#0a1a14'; g.fillRect(0, 0, w, h); g.fillStyle = '#3aff9a'; g.font = '16px monospace'; g.fillText('CAM 1  CAM 2  CAM 3', 12, 24); g.fillText('K-4 SECURITY', 12, 110); });
    const secScreen = mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ color: '#222' }), { parent: world.scene, pos: [40, 1.8, 31.8], rot: [0, Math.PI, 0], cast: false });
    // service corridor pipes & exit sign
    for (let i = 0; i < 3; i++) mesh(G.cyl(0.12, 0.12, 34, 8), mat('#4b4f4a', { metal: 0.5 }), { parent: world.scene, pos: [49.6, 2.4 + i * 0.3, 18], rot: [Math.PI / 2, 0, 0], cast: false });
    const exitSign = mesh(G.box(1.2, 0.35, 0.08), new THREE.MeshBasicMaterial({ color: '#1f9a4a' }), { parent: world.scene, pos: [48, 3.0, 35.7], cast: false });
    // exterior: D-01 jeeps
    const j1 = makeJeep(); j1.position.set(14, jH(14, 55), 55); j1.rotation.set(0.05, 0.6, 0.08); world.add(j1); world.circles.push({ x: 14, z: 55, r: 2.3 });
    const j2 = makeJeep('#56553f'); j2.position.set(33, jH(33, 50), 50); j2.rotation.set(0, -0.4, -0.3); world.add(j2); world.circles.push({ x: 33, z: 50, r: 2.3 });
    const clawTex = canvasTex(128, 64, (g) => { g.strokeStyle = 'rgba(230,220,200,0.9)'; g.lineWidth = 4; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(24 + i * 22, 6); g.lineTo(40 + i * 22, 58); g.stroke(); } });
    mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: clawTex, transparent: true }), { parent: j2, pos: [0.97, 1.0, 0.2], rot: [0, Math.PI / 2, 0], cast: false });
    // companions at the gate
    const lena = makeNPC('lena'); lena.position.set(20.5, 0, 38); lena.rotation.y = Math.PI * 0.9; world.add(lena); world.circles.push({ x: 20.5, z: 38, r: 0.5 });
    const diego = makeNPC('diego'); diego.position.set(27.5, 0, 38.6); diego.rotation.y = -Math.PI * 0.9; world.add(diego); world.circles.push({ x: 27.5, z: 38.6, r: 0.5 });

    // ---------- navigation ----------
    const N = {
      den: [11, 8], den2: [5, 4], den3: [18, 14], denDoor: [10, 17.5], c1: [10, 20], c2: [23, 20], c3: [30, 20], c4: [40, 20], c5: [45, 20],
      labDoor: [30, 17.5], lab: [31, 9], lab2: [26, 3], blast: [39.5, 9.5], cr: [43, 9], cr2: [43, 3.5], emerg: [45.6, 4], sc1: [48, 4], sc2: [48, 20], sc3: [48, 33],
      side: [45.6, 20], sideOut: [46.6, 20], hall: [23, 27], hall2: [16, 27], gnDoor: [6, 21], gn: [7, 27], secDoor: [40, 21], sec: [40, 26.5],
    };
    const nodes = {}; for (const k in N) nodes[k] = { x: N[k][0], z: N[k][1] };
    const nav = new NavGraph(world, nodes, [
      ['den', 'den2'], ['den', 'den3'], ['den', 'denDoor'], ['denDoor', 'c1'], ['c1', 'c2'], ['c2', 'c3'], ['c3', 'c4'], ['c4', 'c5'],
      ['c3', 'labDoor', labDoor], ['labDoor', 'lab'], ['lab', 'lab2'], ['lab', 'blast'], ['blast', 'cr', blast], ['cr', 'cr2'], ['cr2', 'emerg'], ['emerg', 'sc1', emerg],
      ['sc1', 'sc2'], ['sc2', 'sc3'], ['c5', 'side'], ['side', 'sideOut', side], ['sideOut', 'sc2'],
      ['c2', 'hall'], ['hall', 'hall2'], ['c1', 'gnDoor'], ['gnDoor', 'gn'], ['c4', 'secDoor'], ['secDoor', 'sec'],
    ]);
    const patrolPts = ['den', 'den3', 'c1', 'c2', 'hall', 'hall2', 'c4', 'sec', 'gn', 'c3'];

    // ---------- state ----------
    const S = { stage: 'outside', gen: false, power: { light: true, lab: false, cams: true, vent: true }, secVisited: false, lures: 3, lureSpots: [], seen: false, cp: 'start', alphaHunt: false, slammed: false, dna: false, escape: false, diegoShots: 0, labSeen: false };
    const applyPower = () => {
      const on = S.gen;
      reds.forEach((l) => { l.intensity = on && S.power.light ? 5 : 0; });
      labDoor.set(on && S.power.lab);
      world.noiseMul = on && S.power.vent ? 0.5 : 1;
      Sound.bed('hum', on && S.power.vent ? 0.05 : on ? 0.02 : 0);
      ['light', 'lab', 'cams', 'vent'].forEach((k, i) => panelLeds[i].material.color.set(on && S.power[k] ? '#3aff7a' : '#402020'));
      secScreen.material = on && S.power.cams ? new THREE.MeshBasicMaterial({ map: secTex }) : new THREE.MeshBasicMaterial({ color: '#111' });
    };

    // ---------- raptors ----------
    class Raptor {
      constructor(name, home, alpha = false) {
        this.name = name; this.alpha = alpha;
        this.g = makeRaptor({ notch: alpha, skin: alpha ? '#5e5a44' : pick(['#55584a', '#4f5344']), stripe: alpha ? '#2e2b22' : '#34372d' });
        world.add(this.g);
        this.home = home;
        this.pos = new THREE.Vector2(nodes[home].x, nodes[home].z);
        this.yaw = rnd(0, TAU); this.speed = 0; this.state = 'dormant'; this.t = 0; this.path = null; this.goal = null;
        this.col = { x: this.pos.x, z: this.pos.y, r: 0.55 }; world.circles.push(this.col);
        this.lastSeen = null; this.anim = {};
      }
      reset(node) { this.pos.set(nodes[node].x, nodes[node].z); this.state = S.gen ? 'patrol' : 'dormant'; this.path = null; this.goal = null; this.t = rnd(0, 2); this.lastSeen = null; }
      goTo(x, z) { this.goal = { x, z }; this.path = nav.path(this.pos.x, this.pos.y, x, z); }
      canSee(P) {
        const d = dist2d(P.pos.x, P.pos.z, this.pos.x, this.pos.y);
        const lit = (S.gen && S.power.light) || !inside(P.pos.x, P.pos.z);
        const range = (lit ? 17 : 8) * (P.crouch ? 0.6 : 1) * (P.moving ? 1 : 0.7);
        if (d > range) return false;
        const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
        if ((fx * (P.pos.x - this.pos.x) + fz * (P.pos.z - this.pos.y)) / (d || 1) < 0.35 && d > 2.5) return false;
        return losClear(world, this.pos.x, this.pos.y, P.pos.x, P.pos.z);
      }
      hear(P) { const d = dist2d(P.pos.x, P.pos.z, this.pos.x, this.pos.y); return P.noise > 0 && d < P.noise * 1.7; }
      onNoise(x, z, r, kind) {
        if (this.state === 'dormant' || this.state === 'hunt' || this.state === 'rage' || this.state === 'chase') return;
        if (dist2d(x, z, this.pos.x, this.pos.y) > r) return;
        if (kind === 'lure') {
          const repeat = S.lureSpots.some((s) => dist2d(s.x, s.z, x, z) < 6 && Game.time - s.t > 1);
          if (repeat && rng() < 0.55) { this.state = 'doubt'; this.t = 2.5; Sound.sfx('click', 0.6); if (dist2d(Game.player.pos.x, Game.player.pos.z, this.pos.x, this.pos.y) < 30) Journal.add('rap', 'b_learn'); return; }
          if (!S.lureSpots.some((s) => dist2d(s.x, s.z, x, z) < 1)) S.lureSpots.push({ x, z, t: Game.time });
          if (dist2d(Game.player.pos.x, Game.player.pos.z, this.pos.x, this.pos.y) < 30) setTimeout(() => Journal.add('rap', 'b_listen'), 1500);
        }
        this.state = 'investigate'; this.goTo(x, z); this.t = 0;
        Sound.sfx('click', Sound.vol(dist2d(Game.player.pos.x, Game.player.pos.z, this.pos.x, this.pos.y), 3, 30));
      }
      update(dt, P) {
        const d = dist2d(P.pos.x, P.pos.z, this.pos.x, this.pos.y);
        let speed = 0; let tx = null, tz = null;
        this.anim = { alert: false, sniff: false, tilt: false, open: false, crouch: false };
        if (this.state === 'dormant') { this.anim.crouch = true; }
        else if (this.state === 'rage') {
          this.anim.open = Math.sin(Game.time * 6) > 0; this.yaw = dampAngle(this.yaw, Math.PI / 2, 6, dt);
          if (Math.random() < dt * 0.8) { Sound.sfx('thud', 0.4); Sound.sfx('shriek', 0.5); Cam.shake = Math.max(Cam.shake, 0.12); }
        } else {
          const sees = this.canSee(P), hears = this.hear(P);
          if (this.state !== 'stalk' && (sees || (hears && d < 9))) {
            if (this.state !== 'hunt' && this.state !== 'chase') { Sound.sfx('shriek', Sound.vol(d, 3, 40)); if (!S.seen) { S.seen = true; Journal.add('rap', 'seen'); } }
            if (this.state !== 'chase') this.state = 'hunt';
            this.lastSeen = { x: P.pos.x, z: P.pos.z, t: Game.time };
          } else if (hears && this.state === 'patrol') { this.state = 'investigate'; this.goTo(P.pos.x, P.pos.z); this.t = 0; }
          if (this.state === 'patrol') {
            if (!this.path || !this.path.length) {
              this.t -= dt; this.anim.sniff = this.t > 0.8;
              if (this.t <= 0) { const n = pick(patrolPts); this.goTo(nodes[n].x, nodes[n].z); this.t = rnd(1.5, 3.5); }
            }
            speed = 2.2;
          } else if (this.state === 'investigate') {
            speed = 4.2;
            if (!this.path || !this.path.length) { this.t += dt; this.anim.sniff = true; this.anim.tilt = this.t > 1.2 && this.t < 2; if (this.t > 3.2) { this.state = 'patrol'; this.t = 1; } }
          } else if (this.state === 'doubt') {
            this.anim.tilt = true; this.t -= dt; if (this.t <= 0) this.state = 'patrol';
          } else if (this.state === 'stalk') {
            this.t -= dt; speed = 3; this.anim.alert = true;
            const ax = this.pos.x - P.pos.x, az = this.pos.y - P.pos.z, l = Math.hypot(ax, az) || 1;
            if (l < 7) { tx = this.pos.x + (ax / l) * 3; tz = this.pos.y + (az / l) * 3; if (!losClear(world, this.pos.x, this.pos.y, tx, tz)) { tx = null; } }
            if (this.t <= 0) this.state = 'hunt';
          } else if (this.state === 'hunt' || this.state === 'chase') {
            this.anim.alert = true; this.anim.open = d < 4;
            speed = this.state === 'chase' ? 5.9 : 6.2;
            const target = this.state === 'chase' ? { x: P.pos.x, z: P.pos.z } : this.lastSeen;
            if (target && losClear(world, this.pos.x, this.pos.y, target.x, target.z)) { tx = target.x; tz = target.z; this.path = null; }
            else if (target) { if (!this.path || !this.path.length || Math.random() < dt * 2) this.goTo(target.x, target.z); }
            if (this.state === 'hunt' && this.lastSeen && Game.time - this.lastSeen.t > 4) { this.state = 'investigate'; this.goTo(this.lastSeen.x, this.lastSeen.z); this.t = 0; }
            if (d < 1.5) {
              Sound.sfx('shriek', 1);
              const left = P.hurt(1, new THREE.Vector3(this.pos.x, 0, this.pos.y));
              this.state = 'stalk'; this.t = 3.5;
              if (left <= 0) Game.fail('Вас нашли', 'Рапторы охотятся стаей. Гасите свет, прячьтесь, отвлекайте.', () => ctx.restore());
              else HUD.say([{ who: 'Лена (рация)', text: 'Итан! Уходите от него — за угол, в темноту!' }], true);
            }
          }
          // follow path
          if (tx === null && this.path && this.path.length) {
            const n = this.path[0];
            if (dist2d(this.pos.x, this.pos.y, n.x, n.z) < 0.7) this.path.shift();
            else { tx = n.x; tz = n.z; }
            if (!this.path.length && this.goal) { tx = this.goal.x; tz = this.goal.z; if (dist2d(this.pos.x, this.pos.y, tx, tz) < 0.8) { this.goal = null; tx = null; } }
          }
        }
        if (tx !== null) {
          const dx = tx - this.pos.x, dz = tz - this.pos.y, dd = Math.hypot(dx, dz);
          if (dd > 0.2) { const v = Math.min(speed, dd * 3); this.pos.x += (dx / dd) * v * dt; this.pos.y += (dz / dd) * v * dt; this.speed = damp(this.speed, v, 8, dt); this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 8, dt); }
        } else this.speed = damp(this.speed, 0, 6, dt);
        if (this.state === 'hunt' && tx === null) this.yaw = dampAngle(this.yaw, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.y), 5, dt);
        this.col.x = this.pos.x; this.col.z = this.pos.y;
        this.g.position.set(this.pos.x, world.groundH(this.pos.x, this.pos.y), this.pos.y);
        this.g.rotation.y = this.yaw;
        this.g.userData.anim(dt, this.speed, this.anim);
      }
    }
    const raptors = [new Raptor('Зазубрина', 'den', true), new Raptor('r2', 'den2'), new Raptor('r3', 'den3')];
    world.noiseListeners.push((x, z, r, kind) => raptors.forEach((rp) => rp.onNoise(x, z, r, kind)));

    // ---------- power panel UI ----------
    const openPanel = () => new Promise((resolve) => {
      Game.paused = true;
      if (document.pointerLockElement) document.exitPointerLock();
      const names = { light: ['Аварийный свет', 'Видно вам — и видно вас'], lab: ['Двери лаборатории', 'Путь к образцам'], cams: ['Камеры охраны', 'Рапторы на компасе (после поста охраны)'], vent: ['Вентиляция', 'Шум глушит ваши шаги вдвое'] };
      $('choiceEyebrow').textContent = 'Щиток K-4 · резервный генератор';
      $('choiceTitle').textContent = 'Распределение питания';
      const box = $('choiceBtns');
      const render = () => {
        const used = Object.values(S.power).filter(Boolean).length;
        $('choiceText').textContent = `Генератор тянет только 3 системы из 4. Включено: ${used}/3.`;
        box.innerHTML = '';
        for (const k of ['light', 'lab', 'cams', 'vent']) {
          const b = document.createElement('button');
          b.className = 'btn' + (S.power[k] ? ' primary' : '');
          b.innerHTML = `${S.power[k] ? '■' : '□'} ${names[k][0]} <small style="opacity:.7;text-transform:none;letter-spacing:0">— ${names[k][1]}</small>`;
          b.onclick = () => { if (!S.power[k] && used >= 3) { $('choiceText').textContent = 'Мощности не хватает: сначала отключите другую систему.'; return; } S.power[k] = !S.power[k]; Sound.sfx('lever'); render(); };
          box.appendChild(b);
        }
        const done = document.createElement('button'); done.className = 'btn'; done.textContent = 'Готово';
        done.onclick = () => {
          $('choice').hidden = true; Game.paused = false; applyPower();
          // the objective used to keep saying "open the lab" after the doors were already powered
          if (S.power.lab && !S.labSeen && !S.fridge) HUD.objective('Войдите в лабораторию', 'Двери открыты. Выбор систем можно поменять на щитке в любой момент.');
          resolve();
        };
        box.appendChild(done);
      };
      render();
      $('choice').hidden = false;
    });

    // ---------- interactions ----------
    world.interact({ x: 23, z: 33.5, r: 2.6, hold: 1.2, label: 'Протиснуться в заклинившие ворота', enabled: () => !gate.open,
      onUse: () => { gate.set(true); S.stage = 'inside'; S.cp = 'gate'; HUD.objective('Запустите резервный генератор', 'Западное крыло комплекса. Внутри темно — фонарь включён.'); HUD.say([{ who: 'Диего (рация)', text: 'Я держу вход. Если что-то услышишь — не беги. Бегущий — это еда.' }]); } });
    world.interact({ x: 5.5, z: 28, r: 2.4, hold: 1.5, label: 'Запустить генератор', enabled: () => !S.gen && S.stage !== 'outside', onUse: () => startGenerator() });
    world.interact({ x: 14, z: 24.5, r: 2.2, label: 'Щиток: распределить питание', enabled: () => S.gen && !S.escape, onUse: () => openPanel() });
    world.interact({ x: 38, z: 3.4, r: 2.0, hold: 1.0, label: 'Открыть холодильник с образцами', enabled: () => S.stage === 'lab' && !S.fridge, onUse: () => fridgeSample() });
    world.interact({ x: 30, z: 1.4, r: 2.2, label: 'Осмотреть чертёж на стене', enabled: () => S.stage !== 'outside' && !S.blueprint && labDoor.open,
      onUse: () => { S.blueprint = true; Game.state.flags.clueCase = true; HUD.say([{ who: '[Чертёж]', text: '«SAMPLE CASE — REV. 1986 — SLOTS: 6». Шестое гнездо подписано от руки: «Е.»', dur: 5 }, { who: 'Итан', text: 'Шесть гнёзд ещё в восемьдесят шестом. Для кого шестое?', dur: 3 }]); } });
    world.interact({ x: 41, z: 9.6, r: 2.0, hold: 1.0, label: 'Вытащить перо из щели бронедвери', enabled: () => S.slammed && !S.dna, onUse: () => takeFeather() });
    world.interact({ x: 15.5, z: 45, r: 2.4, label: 'Осмотреть джип', enabled: () => !S.jeep,
      onUse: () => { S.jeep = true; HUD.say([{ who: '[Жетон]', text: '«ORIGO FIELD — D-01 — 2001». Экспедиция две тысячи первого года. «Старые изыскания»?', dur: 4.6 }, { who: 'Лена (рация)', text: 'Две тысячи первый… Виктор, вы говорили — одно исследование.' }, { who: 'Хальм (рация)', text: 'Была попытка. Неудачная. Вам не нужно было это знать.' }]); } });
    world.interact({ x: 31.5, z: 47.5, r: 2.2, label: 'Изучить царапины', enabled: () => !Journal.has('rap', 't_claw'), onUse: () => { Journal.add('rap', 't_claw'); HUD.say([{ who: '[Сканер]', text: 'ЦАРАПИНЫ · три когтя + серповидный · глубина 2 см · высота удара 1,4 м', dur: 4 }]); } });
    const featherOut = mesh(G.box(0.04, 0.02, 0.35), mat('#2c2a24'), { parent: world.scene, pos: [26, 0.3, 36], cast: false });
    world.interact({ x: 26, z: 36, r: 2.0, label: 'Изучить перо', enabled: () => !Journal.has('rap', 't_feather'), onUse: () => { Journal.add('rap', 't_feather'); featherOut.visible = false; HUD.say([{ who: '[Сканер]', text: 'ПЕРО · ороговевшее, давно выпавшее · клеток нет', dur: 3.4 }, { who: 'Лена (рация)', text: 'Перья… Значит, у них есть и растущие — с кровотоком. Живые.' }]); } });
    for (const [x, z] of [[15, 26.5], [27, 13.8]]) {
      const crate = mesh(G.box(0.6, 0.4, 0.4), mat('#8a5a2a'), { parent: world.scene, pos: [x, 1.1, z], cast: false });
      world.interact({ x, z, r: 1.8, label: 'Взять шумовые приманки (+2)', enabled: () => crate.visible, onUse: () => { crate.visible = false; S.lures += 2; HUD.toast(`Приманки: ${S.lures}`); } });
    }

    async function startGenerator() {
      S.gen = true; S.cp = 'gen'; S.stage = 'powered';
      Sound.sfx('gen'); await wait(0.8); Sound.sfx('gen'); await wait(0.7); Sound.sfx('gen', 1.2);
      genLamp.material.color.set('#ff3322');
      applyPower();
      Cam.shake = 0.2;
      reds.forEach((l, i) => { l.intensity = 0; setTimeout(() => { l.intensity = S.power.light ? 7 : 0; Sound.sfx('lever', 0.3); }, 250 + i * 160); });
      [0, 1, 2].forEach((i) => setTimeout(() => Sound.sfx('door', 0.5 - i * 0.12), 800 + i * 500));
      setTimeout(() => { Sound.sfx('shriek', 0.45); setTimeout(() => Sound.sfx('shriek', 0.3), 700); }, 2600);
      raptors.forEach((r) => { r.state = 'patrol'; r.t = rnd(2, 6); });
      HUD.throwBtn(true);
      HUD.say([{ who: 'Диего (рация)', text: 'Есть свет.' }, { who: 'Лена (рация)', text: 'Итан… это были все двери? Я слышала… что-то.' }, { who: 'Диего (рация)', text: 'Никто не бежит. Слышишь? Никто не бежит.' }]);
      HUD.objective('Откройте лабораторию', 'Щиток в холле. Генератор тянет 3 системы из 4 — чем пожертвовать?');
      Tutorial.show('lure', IS_TOUCH ? 'Кнопка <kbd>Приманка</kbd> — отвлечь рапторов шумом' : '<kbd>Q</kbd> — бросить шумовую приманку: рапторы идут на звук', () => S.lures < 3, { max: 16 });
    }
    async function fridgeSample() {
      S.fridge = true;
      fridgeLight.material.color.set('#9ad0ff');
      await DNA.collect('rap', false, 'VELOCIRAPTOR');
      await HUD.say([{ who: 'Лена (рация)', text: 'Этикетка… «D-01, 2001». Итан, здесь была экспедиция двадцать пять лет назад. Клетки давно мертвы.' }, { who: 'Лена (рация)', text: 'Нам нужен живой раптор. Растущее перо — с кровотоком. Оно живое, пока растёт.' }]);
      const a = raptors[0];
      a.pos.set(nodes.labDoor.x, nodes.labDoor.z - 1.5); a.state = 'hunt'; a.lastSeen = { x: Game.player.pos.x, z: Game.player.pos.z, t: Game.time + 3 };
      S.alphaHunt = true; S.cp = 'lab';
      Sound.sfx('shriek', 1); Cam.shake = 0.3;
      Cam.pull = { x: a.pos.x, z: a.pos.y, strength: 3, time: 1.5 };
      HUD.objective('Бегите в чистую зону!', 'Бронедверь в восточной стене лаборатории. Закройте её за собой.');
      HUD.say([{ who: 'Лена (рация)', text: 'Итан! Сзади! Бронедверь — справа от вас, бегите!' }], true);
    }
    async function takeFeather() {
      S.dna = true;
      Journal.add('rap', 't_feather', true);
      const ok = await DNA.collect('rap', true, 'VELOCIRAPTOR');
      if (!ok) return;
      Journal.add('rap', 'dna');
      await wait(0.6);
      // reroute: every door opens
      S.escape = true; S.cp = 'escape';
      [labDoor, emerg, side, exitD].forEach((d, i) => setTimeout(() => d.set(true), 300 + i * 400));
      reds.forEach((l) => { l.intensity = 9; });
      Sound.sfx('alarm'); setTimeout(() => Sound.sfx('alarm'), 800); setTimeout(() => Sound.sfx('alarm'), 1600);
      raptors.slice(1).forEach((r) => { r.state = 'chase'; r.pos.set(nodes.c3.x, nodes.c3.z); r.path = null; });
      HUD.say([{ who: 'Лена (рация)', text: 'Двери… Все двери открываются! Закрытие шлюза перебросило питание!' }, { who: 'Диего (рация)', text: 'Аварийный выход — на юге служебного коридора. Я встречу. Беги!' }], true);
      HUD.objective('Бегите к аварийному выходу', 'Через дверь в восточной стене чистой зоны — и на юг по служебному коридору.');
      HUD.danger(true);
    }

    let slowmo = 0;
    const ctx = {
      world,
      spawn: { x: 24, z: 70, yaw: Math.PI },
      markers() {
        const m = [];
        if (S.stage === 'outside') m.push({ x: 23, z: 33, label: 'ворота', goal: true, near: 4, nudge: 'Итан, ворота прямо перед вами. Мы с Диего ждём у входа.', nudgeWho: 'Лена' });
        else if (!S.gen) m.push({ x: 5, z: 28, label: 'генератор', goal: true, near: 3 });
        else if (!labDoor.open && !S.fridge) m.push({ x: 13.5, z: 24.5, label: 'щиток', goal: true, near: 2.5 });
        else if (!S.fridge) m.push({ x: 38, z: 3, label: 'образцы', goal: true, near: 2.5 });
        else if (!S.slammed) m.push({ x: 41, z: 9.5, label: 'бронедверь', cls: 'bad', goal: true, near: 3 });
        else if (!S.dna) m.push({ x: 41, z: 9.6, label: 'перо', goal: true, near: 2 });
        else m.push({ x: 48, z: 36, label: 'выход', cls: 'bad', goal: true, near: 3 });
        if (S.gen && S.power.cams && S.secVisited) raptors.forEach((r) => { if (r.state !== 'dormant') m.push({ x: r.pos.x, z: r.pos.y, label: 'раптор', cls: 'bad' }); });
        return m;
      },
      subjects() { return raptors.map((r) => ({ sp: 'rap', obj: r.g, size: 2.4, lift: 1, tag: r.state === 'investigate' ? 'Идёт на шум' : '', item: r.state === 'investigate' ? 'b_listen' : null, special: r.state === 'investigate' || r.alpha })); },
      onThrow() {
        if (!S.gen) { HUD.toast('Сначала генератор — рапторы ещё не проснулись'); return; }
        if (S.lures <= 0) { HUD.toast('Приманки закончились — ящики в холле и лаборатории'); return; }
        S.lures--; throwLure(world); HUD.toast(`Приманка брошена · осталось ${S.lures}`, 2);
      },
      async start() {
        Sound.bed('insects', 0.06); Sound.bed('wind', 0.03);
        HUD.objective('Доберитесь до комплекса K-4', 'Осмотрите джипы D-01 по дороге — если хотите знать, что здесь было.');
        HUD.say([{ who: 'Лена (рация)', text: 'Итан, мы с Диего у ворот K-4. Здесь Варн держал рапторов.' }, { who: 'Хальм (рация)', text: 'Генератор — в западном крыле. Без света вы там ничего не найдёте.' }]);
      },
      update(dt) {
        const P = Game.player;
        const ins = inside(P.pos.x, P.pos.z);
        world.ceiling = ins ? 3.35 : null;
        hemi.intensity = damp(hemi.intensity, ins ? 0.08 : 1.05, 2, dt);
        moon.intensity = ins ? 0 : 1.5;
        Sound.bed('insects', ins ? 0 : 0.06);
        if (!S.secVisited && S.gen && P.pos.x > 34.5 && P.pos.z > 22.5 && P.pos.z < 32) { S.secVisited = true; HUD.toast(S.power.cams ? 'Мониторы охраны: рапторы видны на компасе' : 'Мониторы темны — камеры без питания', 3.5); }
        if (!S.labSeen && labDoor.open && P.pos.x > 22.5 && P.pos.x < 40 && P.pos.z < 17.5) { S.labSeen = true; S.stage = 'lab'; S.cp = 'labEntry'; HUD.objective('Осмотрите лабораторию', 'Холодильник с образцами — у северной стены.'); }
        raptors.forEach((r) => r.update(dt, P));
        // blast door moment
        if (S.alphaHunt && !S.slammed) {
          const a = raptors[0];
          const inCR = P.pos.x > 40.4 && P.pos.z < 18;
          if (inCR) {
            HUD.prompt('Закрыть бронедверь!', 'E', null, true);
            const ad = dist2d(a.pos.x, a.pos.y, 40, 9.5);
            if (ad < 9 && slowmo === 0) { slowmo = 2.6; Sound.sfx('shriek', 1); }
            if (Input.pressed('interact')) {
              S.slammed = true; blast.set(false); Game.timeScale = 1; slowmo = -1;
              Cam.shake = 0.7; Sound.sfx('slam', 1.2); setTimeout(() => Sound.sfx('shriek', 1), 150);
              a.state = 'rage'; a.pos.set(38.6, 9.5); a.path = null;
              for (let i = 0; i < 6; i++) { const f = mesh(G.box(0.03, 0.02, 0.3), mat('#2c2a24'), { parent: world.scene, pos: [40.6 + rnd(0, 0.8), 0.02, 9 + rnd(0, 1.2)], rot: [0, rnd(0, TAU), 0], cast: false }); f.userData.feather = true; }
              bloodDecal(world, 40.7, 9.6, 0.5);
              S.cp = 'cr';
              HUD.objective('Возьмите перо', 'Вожак оставил в щели двери растущее перо. Оно живое, пока свежее.');
              HUD.say([{ who: 'Лена (рация)', text: 'Вы… вы захлопнули её прямо перед ней. Итан, в щели перо — с кровью. Берите!' }], true);
              Journal.add('rap', 'seen', true);
            }
          }
          if (slowmo > 0) { slowmo -= dt / Math.max(Game.timeScale || 1, 0.2); Game.timeScale = 0.35; if (slowmo <= 0) { Game.timeScale = 1; slowmo = -1; } }
        }
        // escape: Diego covers the service corridor
        if (S.escape) {
          for (const r of raptors) {
            if (r.state === 'chase' && P.pos.x > 46 && dist2d(r.pos.x, r.pos.y, P.pos.x, P.pos.z) < 6 && S.diegoShots < 4 && (!S.lastShot || Game.time - S.lastShot > 2.2)) {
              S.diegoShots++; S.lastShot = Game.time;
              Sound.sfx('shot', 1); setTimeout(() => Sound.sfx('shot', 0.9), 180);
              r.state = 'stalk'; r.t = 2.4;
              if (S.diegoShots === 1) HUD.say([{ who: 'Диего', text: 'Пригнись! Стреляю!' }], true);
            }
          }
          if (P.pos.z > 35.6 && P.pos.x > 46) {
            S.escape = false; HUD.danger(false);
            raptors.forEach((r) => { r.state = 'patrol'; r.pos.set(nodes.c2.x, nodes.c2.z); });
            (async () => {
              await HUD.say([{ who: 'Диего', text: 'Ты вернулся за образцом и не побежал раньше времени. Ладно, Следопыт.' }, { who: 'Лена', text: 'Два из пяти. Два.' }]);
              Game.complete('river');
            })();
          }
        }
      },
      restore() {
        Game.timeScale = 1;
        const at = { start: [24, 70, Math.PI], gate: [23, 34, Math.PI], gen: [8, 27, Math.PI / 2], labEntry: [30, 16, Math.PI], lab: [30, 16, Math.PI], cr: [43, 9, -Math.PI / 2], escape: [43, 9, -Math.PI / 2] }[S.cp] || [24, 70, Math.PI];
        Game.player.place(at[0], at[1], at[2]);
        raptors.forEach((r, i) => r.reset(['den', 'den2', 'den3'][i]));
        if (S.cp === 'lab') { S.alphaHunt = false; S.fridge = false; S.cp = 'labEntry'; slowmo = 0; }
        if (S.slammed) { raptors[0].state = 'rage'; raptors[0].pos.set(38.6, 9.5); }
        if (S.cp === 'escape') raptors.slice(1).forEach((r) => { r.state = 'chase'; r.pos.set(nodes.c3.x, nodes.c3.z); r.path = null; });
        HUD.danger(S.cp === 'escape');
      },
      dispose() { Game.timeScale = 1; HUD.throwBtn(false); },
    };
    return ctx;
  },
};
