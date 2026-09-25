// ============================================================
// 41-ch-prologue.js — Threshold Station: briefing and the case
// ============================================================
function drawBriefingScreen(g, w, h, st) {
  g.fillStyle = '#04121c'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(80,170,210,0.12)'; g.lineWidth = 1;
  for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  // island silhouette
  g.save(); g.translate(330, 260);
  g.fillStyle = st.veil ? 'rgba(160,180,190,0.35)' : 'rgba(70,160,110,0.55)';
  g.beginPath();
  for (let i = 0; i <= 60; i++) { const a = (i / 60) * TAU; const r = 170 + 30 * Math.sin(a * 3 + 1) + 18 * Math.sin(a * 7); g.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.8); }
  g.fill();
  g.strokeStyle = 'rgba(120,220,170,0.8)'; g.lineWidth = 2; g.stroke();
  if (!st.veil) {
    const zones = [[60, -60], [-40, -20], [110, 40], [-10, -110], [-120, 60]];
    zones.slice(0, st.n).forEach(([x, y], i) => {
      g.strokeStyle = i === 4 ? 'rgba(255,80,60,0.95)' : 'rgba(227,163,59,0.95)';
      g.setLineDash([6, 5]); g.beginPath(); g.arc(x, y, 26, 0, TAU); g.stroke(); g.setLineDash([]);
    });
  }
  g.restore();
  g.fillStyle = '#9fd6ea'; g.font = '600 26px "Fira Sans Extra Condensed", Arial Narrow, sans-serif';
  g.fillText('SITE U — ISOLATED ECOSYSTEM', 40, 50);
  g.fillStyle = 'rgba(159,214,234,0.6)'; g.font = '500 18px "IBM Plex Mono", monospace';
  g.fillText(st.veil ? 'STATUS: CLOUD COVER 100% · VEIL ACTIVE' : 'STATUS: UNEXPLORED 87%', 40, 80);
  const names = ['TRICERATOPS', 'VELOCIRAPTOR', 'SPINOSAURUS', 'PTERANODON', 'TYRANNOSAURUS REX'];
  g.font = '600 28px "Fira Sans Extra Condensed", Arial Narrow, sans-serif';
  names.slice(0, st.n).forEach((n, i) => {
    g.fillStyle = i === 4 ? '#ff6a56' : '#e8f4f6';
    g.fillText(n, 660, 150 + i * 48);
    g.fillStyle = i === 4 ? 'rgba(255,106,86,0.8)' : 'rgba(227,163,59,0.9)';
    g.font = '500 15px "IBM Plex Mono", monospace'; g.fillText('DNA REQUIRED', 660, 170 + i * 48);
    g.font = '600 28px "Fira Sans Extra Condensed", Arial Narrow, sans-serif';
  });
  if (st.n >= 5) {
    g.fillStyle = '#e8f4f6'; g.font = '600 24px "Fira Sans Extra Condensed", Arial Narrow, sans-serif';
    g.fillText('COLLECT DNA SAMPLES', 660, 420);
    g.fillStyle = '#ff5a48'; g.font = '700 54px "IBM Plex Mono", monospace'; g.fillText('0 / 5', 660, 475);
  }
  if (st.title) { g.fillStyle = '#e8f4f6'; g.font = '700 44px "Fira Sans Extra Condensed", Arial Narrow, sans-serif'; g.fillText('EXPEDITION D-05', 660, 150); g.font = '500 18px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(227,163,59,0.9)'; g.fillText('PRIMARY OBJECTIVE:', 660, 200); g.fillText('COLLECT 5 GENETIC SAMPLES', 660, 226); }
}

function makeCaseModel() {
  const g = new THREE.Group();
  mesh(G.box(1.1, 0.22, 0.62), mat('#1b1f20', { rough: 0.45, metal: 0.5 }), { parent: g, pos: [0, 0.11, 0] });
  mesh(G.box(1.02, 0.02, 0.54), mat('#2b2f2a'), { parent: g, pos: [0, 0.225, 0] });
  const lid = new THREE.Group(); lid.position.set(0, 0.22, -0.31); g.add(lid);
  mesh(G.box(1.1, 0.06, 0.62), mat('#1b1f20', { rough: 0.45, metal: 0.5 }), { parent: lid, pos: [0, 0.03, 0.31] });
  lid.rotation.x = -1.9;
  const caps = [];
  for (let i = 0; i < 6; i++) {
    const x = -0.42 + i * 0.168;
    if (i < 5) {
      const c = mesh(G.cyl(0.05, 0.05, 0.36, 10), new THREE.MeshStandardMaterial({ color: '#9fc4d6', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55 }), { parent: g, pos: [x, 0.25, 0], rot: [Math.PI / 2, 0, 0] });
      const ring = mesh(G.cyl(0.055, 0.055, 0.03, 10), new THREE.MeshStandardMaterial({ color: '#222', emissive: new THREE.Color('#e3a33b'), emissiveIntensity: 1.6 }), { parent: g, pos: [x, 0.25, 0.17], rot: [Math.PI / 2, 0, 0], cast: false });
      caps.push({ c, ring });
    } else {
      const naTex = canvasTex(64, 128, (gg, w, h) => { gg.fillStyle = '#6b6f6a'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#1b1d1c'; gg.font = 'bold 26px Arial'; gg.textAlign = 'center'; gg.save(); gg.translate(w / 2, h / 2); gg.rotate(-Math.PI / 2); gg.fillText('N/A', 0, 9); gg.restore(); });
      mesh(G.box(0.1, 0.02, 0.36), new THREE.MeshStandardMaterial({ map: naTex, roughness: 0.7 }), { parent: g, pos: [x, 0.24, 0] });
    }
  }
  g.userData = { lid, caps };
  return g;
}

// corrugated metal for the hangar walls
let _corrTex = null;
function corrugatedTexture() {
  if (_corrTex) return _corrTex;
  _corrTex = canvasTex(128, 128, (g, w, h) => {
    for (let x = 0; x < w; x++) { const v = 96 + Math.round(26 * Math.sin((x / w) * TAU * 8)); g.fillStyle = `rgb(${v},${v + 4},${v + 2})`; g.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,40,25,${rnd(0.04, 0.12)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(2, 8), rnd(10, 60)); }
  }, { repeat: 1 });
  _corrTex.wrapS = _corrTex.wrapT = THREE.RepeatWrapping;
  return _corrTex;
}

CHAPTERS.prologue = {
  create() {
    const world = new World();
    world.floor = () => 0;
    world.ceiling = 3.6;
    world.scene.background = new THREE.Color('#07090a');
    const fog = world.scene.fog = new THREE.Fog('#07090a', 18, 40);
    makeSky(world, { top: '#0a111c', horizon: '#26323c', low: '#090d11', sunDir: new THREE.Vector3(0.7, 0.1, -0.3), sunColor: '#44546a', sunSize: 0 });
    const hemi = new THREE.HemisphereLight('#9fbcd2', '#2a302a', 0.9); world.add(hemi);
    world.hemi = hemi; world.baseHemi = 0.9;
    const warm = new THREE.PointLight('#ffd49a', 22, 18, 1.5); warm.position.set(0, 3.2, 3.5); warm.castShadow = true; world.add(warm);
    const blue = new THREE.PointLight('#6ab8e8', 10, 12, 1.8); blue.position.set(0, 2.4, -1.6); world.add(blue);
    const side = new THREE.PointLight('#ffe0b0', 8, 10, 1.6); side.position.set(7, 2.8, 1); world.add(side);
    // ---------- command room ----------
    const W = 9, D = 7;
    mesh(G.box(W * 2, 0.1, D * 2), mat('#2a2f2d', { rough: 0.7 }), { parent: world.scene, pos: [0, -0.05, 0], receive: true, cast: false });
    mesh(G.box(W * 2, 0.1, D * 2), mat('#1a1d1c'), { parent: world.scene, pos: [0, 3.65, 0], cast: false });
    const wallM = mat('#3a403c', { rough: 0.8 });
    const wall = (x0, x1, z0, z1, h = 3.7, y0 = 0, m = wallM) => { mesh(G.box(x1 - x0, h, z1 - z0), m, { parent: world.scene, pos: [(x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2], receive: true }); if (y0 < 2) world.boxes.push({ x0, x1, z0, z1 }); };
    wall(-W, W, -D - 0.3, -D); wall(-W, W, D, D + 0.3); wall(-W - 0.3, -W, -D, D);
    wall(W, W + 0.3, -D, 3.6); wall(W, W + 0.3, 5.4, D); wall(W, W + 0.3, 3.6, 5.4, 1.1, 2.6);
    // screen
    const scr = { n: 0, veil: true, title: false };
    const scrCanvas = document.createElement('canvas'); scrCanvas.width = 1024; scrCanvas.height = 512;
    const scrTex = new THREE.CanvasTexture(scrCanvas); scrTex.colorSpace = THREE.SRGBColorSpace;
    const redraw = () => { drawBriefingScreen(scrCanvas.getContext('2d'), 1024, 512, scr); scrTex.needsUpdate = true; };
    redraw();
    mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }), { parent: world.scene, pos: [0, 2.0, -6.95], cast: false });
    // holotable
    mesh(G.cyl(1.6, 1.8, 0.9, 20), mat('#1c2426', { metal: 0.5, rough: 0.4 }), { parent: world.scene, pos: [0, 0.45, -1.6] });
    const holo = mesh(G.cyl(1.4, 1.4, 0.02, 24), new THREE.MeshBasicMaterial({ color: '#4fc3e8', transparent: true, opacity: 0.35 }), { parent: world.scene, pos: [0, 0.95, -1.6], cast: false });
    const holoIsland = mesh(G.cone(1.0, 0.6, 10), new THREE.MeshBasicMaterial({ color: '#56d6a0', wireframe: true, transparent: true, opacity: 0.6 }), { parent: world.scene, pos: [0, 1.3, -1.6], cast: false });
    world.circles.push({ x: 0, z: -1.6, r: 1.9 });
    world.onUpdate((dt) => { holoIsland.rotation.y += dt * 0.3; holo.material.opacity = 0.3 + Math.sin(Game.time * 3) * 0.05; });
    // desks & monitors
    const deskM = mat('#2c3130'), monM = new THREE.MeshBasicMaterial({ color: '#1f5a70' });
    [[-4.5, 3], [4.5, 3], [-6.5, -3.5], [6.5, -3.5]].forEach(([x, z]) => {
      mesh(G.box(3.2, 0.8, 1), deskM, { parent: world.scene, pos: [x, 0.4, z], receive: true });
      mesh(G.box(0.9, 0.55, 0.05), monM, { parent: world.scene, pos: [x - 0.7, 1.1, z - 0.3], cast: false });
      mesh(G.box(0.9, 0.55, 0.05), monM, { parent: world.scene, pos: [x + 0.7, 1.1, z - 0.3], cast: false });
      world.boxes.push({ x0: x - 1.6, x1: x + 1.6, z0: z - 0.5, z1: z + 0.5, low: true });
    });
    // case table, lit so it reads as the next stop
    mesh(G.box(2, 0.9, 1.2), mat('#dfe2dd', { rough: 0.5 }), { parent: world.scene, pos: [7.3, 0.45, 0.8] });
    world.boxes.push({ x0: 6.3, x1: 8.3, z0: 0.2, z1: 1.4, low: true });
    const caseM = makeCaseModel(); caseM.position.set(7.3, 0.9, 0.8); caseM.rotation.y = -Math.PI / 2; world.add(caseM);
    const caseSpot = new THREE.SpotLight('#dff2ff', 0, 7, 0.5, 0.6, 1.4); caseSpot.position.set(7.3, 3.4, 0.8); caseSpot.target.position.set(7.3, 0.9, 0.8); world.add(caseSpot); world.add(caseSpot.target);
    // storage crate: D-04 personal effects
    const boxTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#6a6448'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1a12'; g.font = 'bold 22px Arial'; g.fillText('D-04 — PERSONAL EFFECTS', 12, 50); g.font = 'bold 26px Arial'; g.fillText('UNCLAIMED', 12, 92); });
    mesh(G.box(1.1, 0.7, 0.8), new THREE.MeshLambertMaterial({ map: boxTex }), { parent: world.scene, pos: [-7.8, 0.35, 5.6], rot: [0, 0.3, 0] });
    world.circles.push({ x: -7.8, z: 5.6, r: 0.7 });
    // ARK MIRROR door (west wall)
    const arkTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#b8281e'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 24px Arial'; g.textAlign = 'center'; g.fillText('ARK MIRROR — RESTRICTED', w / 2, 40); });
    mesh(G.box(0.08, 2.4, 1.4), mat('#2b3033', { metal: 0.4 }), { parent: world.scene, pos: [-8.95, 1.2, -1], cast: false });
    mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: arkTex }), { parent: world.scene, pos: [-8.9, 2.6, -1], rot: [0, Math.PI / 2, 0], cast: false });
    // hangar door (east wall): a real sliding door, plus the yellow sign
    const hangTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#e3a33b'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText('HANGAR →', w / 2, 44); });
    mesh(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshBasicMaterial({ map: hangTex }), { parent: world.scene, pos: [8.84, 2.95, 4.5], rot: [0, -Math.PI / 2, 0], cast: false });
    const hDoor = new Door(world, { x0: 9.15, z0: 3.6, x1: 9.15, z1: 5.4, h: 2.6, color: '#39403a', stripe: true, speed: 3 });
    const doorLamp = new THREE.PointLight('#ffb040', 0, 6, 1.6); doorLamp.position.set(8.3, 2.9, 4.5); world.add(doorLamp);

    // ---------- hangar ----------
    const HX0 = 9.3, HX1 = 30, HZ0 = -6, HZ1 = 14, HH = 8;
    const conc = new THREE.MeshStandardMaterial({ color: '#3b3e3c', roughness: 0.62, metalness: 0.05 });
    mesh(G.box(HX1 - W, 0.1, HZ1 - HZ0), conc, { parent: world.scene, pos: [(W + HX1) / 2, -0.05, (HZ0 + HZ1) / 2], receive: true, cast: false });
    mesh(G.box(HX1 - HX0, 0.2, HZ1 - HZ0), mat('#1d2021'), { parent: world.scene, pos: [(HX0 + HX1) / 2, HH, (HZ0 + HZ1) / 2], cast: false });
    const ct = corrugatedTexture().clone(); ct.needsUpdate = true; ct.repeat.set(6, 1);
    const corr = new THREE.MeshStandardMaterial({ map: ct, color: '#8a9088', roughness: 0.55, metalness: 0.45 });
    wall(HX0, HX1, HZ0 - 0.3, HZ0, HH, 0, corr); wall(HX0, HX1, HZ1, HZ1 + 0.3, HH, 0, corr);
    wall(W, HX0, D, HZ1, HH, 0, corr);
    mesh(G.box(0.3, HH - 3.7, HZ1 - HZ0), corr, { parent: world.scene, pos: [W + 0.15, 3.7 + (HH - 3.7) / 2, (HZ0 + HZ1) / 2], cast: false });
    wall(HX1, HX1 + 0.3, HZ0, -3, HH, 0, corr); wall(HX1, HX1 + 0.3, 11, HZ1, HH, 0, corr);
    mesh(G.box(0.3, 2, 14), corr, { parent: world.scene, pos: [HX1 + 0.15, HH - 1, 4], cast: false });
    // big door leaves slid open
    for (const z of [-4.6, 12.6]) { mesh(G.box(0.25, 6, 3.2), mat('#4a4f4a', { metal: 0.5, rough: 0.5 }), { parent: world.scene, pos: [HX1 + 0.5, 3, z] }); world.boxes.push({ x0: HX1 + 0.35, x1: HX1 + 0.65, z0: z - 1.6, z1: z + 1.6 }); }
    for (let i = 0; i < 6; i++) mesh(G.box(0.3, 0.35, HZ1 - HZ0), mat('#262a2a', { metal: 0.6 }), { parent: world.scene, pos: [HX0 + 2 + i * 3.6, HH - 0.5, (HZ0 + HZ1) / 2], cast: false });
    // painted guide line from the door to the pad
    const lineM = new THREE.MeshStandardMaterial({ color: '#d8a52a', roughness: 0.6, emissive: new THREE.Color('#3a2a06'), emissiveIntensity: 0.6 });
    mesh(G.box(HX1 - HX0 + 12, 0.012, 0.18), lineM, { parent: world.scene, pos: [HX0 + (HX1 - HX0 + 12) / 2, 0.01, 4.5], cast: false });
    for (let x = HX0 + 3; x < HX1 + 10; x += 4) mesh(G.box(1.1, 0.012, 0.14), lineM, { parent: world.scene, pos: [x, 0.012, 4.5], rot: [0, 0.6, 0], cast: false });
    // pendant lamps
    const lamps = [[14, 4], [21, 0], [21, 9], [27, 4]].map(([x, z]) => {
      mesh(G.cyl(0.2, 0.55, 0.35, 12), mat('#2a2e2c', { metal: 0.6 }), { parent: world.scene, pos: [x, HH - 1.4, z], cast: false });
      mesh(G.sphere(0.16, 10, 6), new THREE.MeshBasicMaterial({ color: '#ffe6b8' }), { parent: world.scene, pos: [x, HH - 1.6, z], cast: false });
      mesh(G.cyl(0.02, 0.02, 1.2, 4), mat('#111'), { parent: world.scene, pos: [x, HH - 0.7, z], cast: false });
      const l = new THREE.PointLight('#ffd9a0', 16, 15, 1.6); l.position.set(x, HH - 1.8, z); world.add(l); return l;
    });
    // hangar props: crates, drums, tow tug, workbench
    const crateM = mat('#4f5a3c'), drumM = mat('#6a2f24', { metal: 0.3, rough: 0.6 });
    [[12, -4.5, 1.2], [13.4, -4.2, 0.9], [12.6, -4.3, 0.8, 1.05], [26, 12.2, 1.1], [24.6, 12.4, 0.9]].forEach(([x, z, s, y = 0]) => { mesh(G.box(1.2 * s, 0.8 * s, 1 * s), crateM, { parent: world.scene, pos: [x, y + 0.4 * s, z], rot: [0, rnd(-0.2, 0.2), 0], receive: true }); if (!y) world.circles.push({ x, z, r: 0.8 * s }); });
    for (let i = 0; i < 5; i++) { const x = 17 + (i % 3) * 0.7, z = 12.6 - Math.floor(i / 3) * 0.7; mesh(G.cyl(0.3, 0.3, 0.9, 12), drumM, { parent: world.scene, pos: [x, 0.45, z] }); }
    world.circles.push({ x: 17.7, z: 12.3, r: 1.3 });
    mesh(G.box(3, 0.9, 0.9), mat('#3e4240', { metal: 0.4 }), { parent: world.scene, pos: [20, 0.45, -5.3], receive: true }); world.boxes.push({ x0: 18.5, x1: 21.5, z0: -5.75, z1: -4.85, low: true });
    const tug = new THREE.Group(); mesh(G.box(1.6, 0.8, 2.6), mat('#b8952a'), { parent: tug, pos: [0, 0.6, 0] }); mesh(G.box(1.4, 0.7, 1), mat('#2a2a2a'), { parent: tug, pos: [0, 1.3, -0.6] }); for (const [a, b] of [[-0.8, 0.9], [0.8, 0.9], [-0.8, -0.9], [0.8, -0.9]]) mesh(G.cyl(0.32, 0.32, 0.28, 12), mat('#141414'), { parent: tug, pos: [a, 0.32, b], rot: [0, 0, Math.PI / 2] });
    tug.position.set(15, 0, 10.5); tug.rotation.y = 0.3; world.add(tug); world.circles.push({ x: 15, z: 10.5, r: 1.6 });

    // ---------- helipad outside ----------
    const PX1 = 60, PZ0 = -14, PZ1 = 22, HPX = 44, HPZ = 4;
    const wet = new THREE.MeshStandardMaterial({ color: '#23282b', roughness: 0.22, metalness: 0.25 });
    mesh(G.box(PX1 - HX1, 0.1, PZ1 - PZ0), wet, { parent: world.scene, pos: [(HX1 + PX1) / 2, -0.05, (PZ0 + PZ1) / 2], receive: true, cast: false });
    const padM = new THREE.MeshStandardMaterial({ color: '#d8a52a', roughness: 0.4, emissive: new THREE.Color('#2a1e04'), emissiveIntensity: 0.5 });
    mesh(new THREE.RingGeometry(9.3, 9.8, 64).rotateX(-Math.PI / 2), padM, { parent: world.scene, pos: [HPX, 0.012, HPZ], cast: false });
    const hM = new THREE.MeshStandardMaterial({ color: '#e8e6de', roughness: 0.4 });
    for (const dz of [-1.6, 1.6]) mesh(G.box(0.6, 0.012, 4.6), hM, { parent: world.scene, pos: [HPX + dz * 0 + (dz < 0 ? -1.8 : 1.8), 0.013, HPZ], cast: false });
    mesh(G.box(3.0, 0.012, 0.6), hM, { parent: world.scene, pos: [HPX, 0.013, HPZ], cast: false });
    const edgeM = new THREE.MeshBasicMaterial({ color: '#7fd0ff' });
    for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; mesh(G.cyl(0.07, 0.09, 0.14, 8), edgeM, { parent: world.scene, pos: [HPX + Math.cos(a) * 11, 0.07, HPZ + Math.sin(a) * 11], cast: false }); }
    // railings round the pad; the sea beyond
    const railM = mat('#5a5f5a', { metal: 0.5 });
    const rail = (x0, x1, z0, z1) => { mesh(G.box(Math.max(0.08, x1 - x0), 1.1, Math.max(0.08, z1 - z0)), railM, { parent: world.scene, pos: [(x0 + x1) / 2, 0.55, (z0 + z1) / 2], cast: false }); world.boxes.push({ x0: x0 - 0.1, x1: x1 + 0.1, z0: z0 - 0.1, z1: z1 + 0.1, low: true }); };
    rail(PX1, PX1 + 0.1, PZ0, PZ1); rail(HX1, PX1, PZ0 - 0.1, PZ0); rail(HX1, PX1, PZ1, PZ1 + 0.1);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0c1a22', roughness: 0.25, metalness: 0.4 }));
    sea.position.set(0, -7, 0); world.add(sea);
    // floodlights & mast
    const floods = [[33, -11, 0], [56, 19, 1]].map(([x, z, i]) => {
      mesh(G.cyl(0.12, 0.16, 9, 8), railM, { parent: world.scene, pos: [x, 4.5, z] }); world.circles.push({ x, z, r: 0.4 });
      mesh(G.box(0.9, 0.5, 0.4), mat('#222'), { parent: world.scene, pos: [x, 9, z], cast: false });
      mesh(G.box(0.8, 0.4, 0.05), new THREE.MeshBasicMaterial({ color: '#fff4dc' }), { parent: world.scene, pos: [x + (i ? -0.2 : 0.2), 8.95, z + (i ? -0.2 : 0.2)], cast: false });
      const s = new THREE.SpotLight('#fff0d8', 120, 70, 0.45, 0.5, 1.2); s.position.set(x, 9, z); s.target.position.set(HPX, 0, HPZ); s.castShadow = i === 0 && QUALITY > 0; if (s.castShadow) { s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0006; } world.add(s); world.add(s.target); return s;
    });
    const mast = new THREE.Group(); mesh(G.cyl(0.18, 0.4, 30, 6), mat('#3a3e40', { metal: 0.5 }), { parent: mast, pos: [0, 15, 0], cast: false }); const mastLed = mesh(G.sphere(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3020' }), { parent: mast, pos: [0, 30.3, 0], cast: false }); mast.position.set(52, 0, -32); world.add(mast);
    world.onUpdate(() => { mastLed.visible = (Game.time % 1.6) < 0.5; });
    const rain = makeRain(world); rain.visible = false;
    // the helicopter: nose north, cabin door facing the hangar
    const heli = makeHelicopter({ label: 'D-05' });
    heli.rotation.order = 'YXZ';
    heli.position.set(HPX, 0, HPZ); heli.rotation.y = Math.PI; world.add(heli);
    [[HPX, 1.5, 1.4], [HPX, 3.8, 1.5], [HPX, 6.2, 1.3], [HPX, 9.4, 0.6], [HPX, 11.8, 0.6]].forEach(([x, z, r]) => world.circles.push({ x, z, r }));
    world.onUpdate((dt) => heli.userData.update(dt));
    const DOOR_OUT = { x: 41.7, z: 3.4 };

    // ---------- people ----------
    const npc = {};
    const put = (key, x, z, ry, look = key, variant) => { const n = makeNPC(look, variant); n.position.set(x, 0, z); n.rotation.y = ry; world.add(n); npc[key] = n; return n; };
    put('halm', 0.3, -4.6, 0.1); put('lena', -3.6, -2.2, 0.9, 'lena', 'lab'); put('diego', 5.4, -2.2, -0.7); put('lucas', 3.6, 1.6, -2.6);
    put('yusuf', 8.1, 1.9, -2.2); put('tech1', -4.6, 3.9, Math.PI, 'tech');
    world.circles.push({ x: 8.1, z: 1.9, r: 0.45 }, { x: -4.6, z: 3.9, r: 0.45 });
    const comp = {};
    for (const k of ['halm', 'lena', 'diego', 'lucas']) { comp[k] = new Companion(world, npc[k]); comp[k].setHold(npc[k].position.x, npc[k].position.z, k === 'halm' ? null : npc[k].rotation.y); }
    const board = (k, seat) => { if (!npc[k].userData.seated) { if (comp[k] && !comp[k].detached) comp[k].detach(); heli.userData.seat(npc[k], seat); } };

    Sound.bed('rain', 0.04); Sound.bed('hum', 0.035);
    const S = { stage: 0, moved: 0, engine: false };
    const spawn = { x: 0, z: 3.2 };
    const ctx = {
      world, spawn: { x: 0, z: 3.2, yaw: Math.PI }, allowPhoto: false,
      get guide() { return { key: S.stage === 0 ? 'nora' : 'lena' }; },
      markers() {
        if (S.stage === 0) return [{ x: 0.3, z: -4.6, label: 'Хальм', goal: true, near: 3.4, nudge: 'Мистер Рид, Хальм ждёт вас у большого экрана — в центре зала.', nudgeWho: 'Нора (интерком)' }];
        if (S.stage === 1) return [{ x: 7.3, z: 0.8, label: 'кейс', goal: true, near: 2.6 }];
        if (S.stage === 2) return [{ x: 8.9, z: 4.5, label: 'ангар', goal: true, near: 2.2 }];
        if (S.stage === 3) return [{ x: DOOR_OUT.x, z: DOOR_OUT.z, label: 'вертолёт', goal: true, near: 2.8 }];
        return [];
      },
      subjects() { return []; },
      async start() {
        HUD.objective('Доложите Хальму о прибытии', 'Командный центр. Хальм — седой, в длинном тёмном пальто, у большого экрана.');
        Tutorial.show('move', IS_TOUCH ? 'Левый палец — идти, правый — осмотреться' : '<kbd>W A S D</kbd> — идти · <kbd>мышь</kbd> — осмотреться (клик захватывает курсор)', () => S.moved > 2.5, { max: 14 });
        await wait(1.2);
        HUD.say([{ who: 'Нора (интерком)', text: 'Мистер Рид, брифинг начинается. Командный центр, у большого экрана.' }]);
      },
      update(dt) {
        const P = Game.player, x = P.pos.x;
        S.moved = Math.max(S.moved, dist2d(P.pos.x, P.pos.z, spawn.x, spawn.z));
        const outside = x > HX1 - 0.5, hangar = x > HX0 - 0.2;
        world.ceiling = outside ? null : hangar ? HH - 0.3 : 3.6;
        fog.near = outside ? 22 : hangar ? 24 : 18; fog.far = outside ? 120 : hangar ? 80 : 40;
        fog.color.set(outside || hangar ? '#0b1116' : '#07090a');
        rain.visible = camera.position.x > HX1 - 2;
        Sound.bed('rain', outside ? 0.17 : hangar ? 0.09 : 0.04);
        Sound.bed('hum', hangar ? 0.01 : 0.035);
        caseSpot.intensity = damp(caseSpot.intensity, S.stage === 1 ? 26 : 0, 2, dt);
        doorLamp.intensity = S.stage === 2 ? 4 + Math.sin(Game.time * 4) * 2 : 0;
        if (S.stage === 2 && x > HX0 + 0.4) {
          S.stage = 3;
          HUD.objective('Садитесь в вертолёт', 'Площадка за воротами ангара. Диего ждёт у двери вертолёта.');
          HUD.say([{ who: 'Диего', text: 'Следопыт! Сюда, к двери. И голову ниже — винт крутится.' }]);
        }
        // Diego beckons from the helicopter door
        if (S.stage === 3 && comp.diego && !comp.diego.detached && dist2d(P.pos.x, P.pos.z, DOOR_OUT.x, DOOR_OUT.z) < 30 && dist2d(P.pos.x, P.pos.z, DOOR_OUT.x, DOOR_OUT.z) > 5 && (Game.time % 6) < 0.05) comp.diego.gesture('wave', null, 1.6);
      },
      restore() { const at = S.stage >= 3 ? [12, 4.5, -Math.PI / 2] : [0, 3.2, Math.PI]; Game.player.place(at[0], at[1], at[2]); },
    };
    function startEngine() {
      if (S.engine) return;
      S.engine = true;
      board('lucas', 0);
      heli.userData.start();
    }
    // ---------- briefing ----------
    world.interact({
      x: 0.3, z: -3.6, r: 2.4, label: 'Поговорить с Хальмом', npc: 'halm', enabled: () => S.stage === 0,
      onUse: async () => {
        S.stage = -1;
        const P = Game.player;
        P.place(0, -2.8 + 4.2, Math.PI);
        const lines = (arr) => HUD.say(arr.map(([who, text, dur]) => ({ who, text, dur })));
        warm.intensity = 5; side.intensity = 3;
        await Cine.play([
          { from: V(0, 2.6, 6), to: V(0, 2.2, 3.5), look: V(0, 1.9, -6), dur: 4, cut: true, onStart: () => { Sound.sfx('door'); scr.veil = true; redraw(); lines([['Хальм', 'Доброе утро. Кто ещё не проснулся — сейчас проснётся. Это Умбра.', 4]]); } },
          { from: V(2.2, 1.7, -1.8), to: V(1.7, 1.7, -2.4), look: V(0.3, 1.55, -4.6), dur: 7, cut: true, onStart: () => lines([['Хальм', 'Сорок лет её нет ни на одной карте. Под этими облаками — экосистема, которой не должно существовать.', 4.2], ['Лена', '«Не должно» — в каком смысле?', 2.6]]) },
          { from: V(-3.2, 1.8, 0.6), to: V(-2.6, 1.8, 0.2), look: V(0.3, 1.5, -4.6), dur: 7, cut: true, onStart: () => { scr.veil = false; redraw(); Sound.sfx('ping'); lines([['Хальм', 'В любом, доктор Арден. Предыдущие исследования… исследование было прекращено. Связь с частью старых объектов потеряна.', 5], ['Хальм', 'Что там сейчас — мы не знаем. Поэтому летите вы.', 2.5]]); } },
          { from: V(0, 2.1, -3.0), to: V(0, 2.05, -3.6), look: V(1.8, 2.1, -6.95), dur: 9.5, cut: true, onStart: () => {
            lines([['Хальм', 'Пять видов. Пять генетических образцов.', 2.6], ['Хальм', 'Трицератопс. Велоцираптор. Спинозавр. Птеранодон.', 3.6]]);
            [0, 1, 2, 3].forEach((i) => setTimeout(() => { scr.n = i + 1; redraw(); Sound.sfx('ping', 0.8); }, 2600 + i * 900));
          } },
          { from: V(0, 2.05, -3.6), look: V(1.8, 2.1, -6.95), dur: 2.2, onStart: () => { Sound.silenceAll(0.4); } },
          { from: V(0.6, 2.0, -4.2), to: V(0.5, 2.0, -4.6), look: V(1.8, 2.0, -6.95), dur: 3.5, onStart: () => { scr.n = 5; redraw(); Sound.sfx('thud', 0.9); Sound.tone(49, 2.5, 'sawtooth', 0.12, 0, 41); lines([['Хальм', 'И тираннозавр.', 2.4]]); } },
          { from: V(3.2, 1.7, -0.6), to: V(3.4, 1.7, -0.9), look: V(5.4, 1.6, -2.2), dur: 3.2, cut: true, onStart: () => lines([['Диего', 'Вы серьёзно хотите, чтобы мы приблизились к нему?', 3]]) },
          { from: V(1.4, 1.7, -2.6), look: V(0.3, 1.55, -4.6), dur: 3.2, cut: true, onStart: () => lines([['Хальм', 'Вам не нужно его убивать. Нам нужен только образец.', 3]]) },
          { from: V(1.6, 1.7, 3.8), to: V(1.9, 1.7, 3.6), look: V(3.6, 1.2, 1.6), dur: 4.2, cut: true, onStart: () => lines([['Лукас', 'Отличная новость. А ему кто-нибудь скажет, что нам нужен только образец?', 4]]) },
        ], { skippable: true });
        Sound.bed('rain', 0.04); Sound.bed('hum', 0.035);
        const ans = await choose('Брифинг', 'Спросить Хальма', 'Хальм ждёт вопросов. Можно спросить или промолчать.', [
          { id: 'why', label: '«Почему я? Я не учёный.»' },
          { id: 'prev', label: '«Что случилось с прошлой группой?»' },
          { id: 'none', label: 'Промолчать' },
        ]);
        Game.state.flags.briefQ = ans;
        if (ans === 'why') await HUD.say([{ who: 'Хальм', text: 'Потому что учёные смотрят на животных. А вы — на то, что животные оставляют.' }]);
        else if (ans === 'prev') await HUD.say([{ who: 'Хальм', text: '<em>(пауза)</em> Они приняли неверные решения. Вы примете верные.' }]);
        else await HUD.say([{ who: '', text: '<em>Хальм смотрит на Итана дольше, чем на остальных, и кивает.</em>', dur: 2.6 }]);
        warm.intensity = 14; side.intensity = 8;
        S.stage = 1;
        HUD.objective('Получите кейс у Лены', 'Идите за Леной к столу ДНК-лаборатории у восточной стены.');
        HUD.say([{ who: 'Хальм', text: 'Вылет в шесть десять. Доктор Арден, выдайте мистеру Риду комплект.' }, { who: 'Лена', text: 'Идёмте, Итан. Кейс у меня в лаборатории.' }]);
        comp.lena.lead([[-2.4, 0.6], [2.6, 0.9], [5.3, 1.7]], { wait: 8, onArrive: () => comp.lena.setHold(5.3, 1.7, Math.PI / 2), calls: [{ who: 'Лена', text: 'Итан, сюда. Стол у восточной стены.' }] });
      },
    });
    // ---------- the case ----------
    world.interact({
      x: 6.4, z: 0.8, r: 2.0, label: 'Взять кейс', enabled: () => S.stage === 1,
      onUse: async () => {
        S.stage = -1;
        const caps = caseM.userData.caps;
        caps.forEach((c) => { c.ring.material.emissiveIntensity = 0; });
        await Cine.play([
          { from: V(6.3, 1.9, 0.8), to: V(6.55, 1.7, 0.8), look: V(7.3, 0.95, 0.8), dur: 3.6, cut: true, fov: 45, onStart: () => { Sound.sfx('lever'); HUD.say([{ who: 'Юсуф', text: 'Пять капсул. Каждая держит клетки живыми до двух недель.', dur: 3.4 }]); caps.forEach((c, i) => setTimeout(() => { c.ring.material.emissiveIntensity = 1.6; Sound.sfx('ping', 0.6); }, 400 + i * 450)); } },
          { from: V(7.3, 1.75, 0.2), to: V(7.3, 1.6, 0.55), look: V(7.3, 0.95, 1.28), dur: 4.6, cut: true, fov: 40, onStart: () => {
            HUD.say([{ who: 'Лена', text: 'Главное правило, Итан. Нам нужна <b>живая</b> ткань. Кровь, перо, биопсия. Мёртвое не подойдёт — клетки должны дышать.', dur: 4.6 }]);
            npc.lena = comp.lena.swapModel(makeNPC('lena')); // off camera: the lab coat comes off for the field kit
          } },
          { from: V(7.3, 1.5, 0.8), to: V(7.25, 1.35, 1.0), look: V(7.3, 0.95, 1.28), dur: 3.4, fov: 34, onStart: () => HUD.say([{ who: 'Лена', text: 'А шестое?', dur: 1.6 }, { who: 'Юсуф', text: 'Старый чертёж. Кейсы делают по спецификации восьмидесятых. Не обращайте внимания.', dur: 3.2 }]) },
          { from: V(5.6, 1.9, 2.2), look: V(7.3, 1.0, 0.8), dur: 2.6, cut: true, fov: 50, onStart: () => HUD.say([{ who: 'Лена', text: '<em>(тихо)</em> В восьмидесятых…', dur: 2.2 }]) },
        ]);
        caseM.visible = false;
        Game.state.flags.hasCase = true;
        HUD.renderCase();
        HUD.big('GENETIC SAMPLES: 0/5', 'КЕЙС НА РЮКЗАКЕ · ОГОНЬКИ ПОКАЗЫВАЮТ ПРОГРЕСС', '', 3.8);
        S.stage = 2;
        HUD.objective('Идите в ангар', 'Дверь с жёлтой табличкой у восточной стены. Вертолёт уже прогревают.');
        HUD.say([{ who: 'Хальм', text: 'Мистер Рид. Первое правило острова: там тихо, если тихо вы сами.' }, { who: 'Лукас', text: 'Всё, пошёл греть машину. Следопыт, не отставай!' }]);
        hDoor.set(true);
        comp.lena.follow({ dist: 2.4 });
        // the team heads out ahead of the player: people walking somewhere are the clearest signpost
        setTimeout(() => comp.lucas.walk([[8.2, 4.5], [11, 4.5], [29, 4.5], [DOOR_OUT.x, DOOR_OUT.z]], { run: true }).then(startEngine), 900);
        setTimeout(() => comp.diego.walk([[8.2, 4.2], [11, 3.8], [29, 3.6], [40.4, 1.4]]).then(() => comp.diego.setHold(40.4, 1.4, -Math.PI / 2)), 2200);
        setTimeout(() => comp.halm.walk([[3, 4.2], [8.2, 4.8], [11, 5.2], [29, 5.4], [DOOR_OUT.x, DOOR_OUT.z + 0.3]]).then(() => board('halm', 1)), 3800);
      },
    });
    // ---------- boarding ----------
    world.interact({ x: DOOR_OUT.x, z: DOOR_OUT.z, r: 2.6, label: 'Сесть в вертолёт', enabled: () => S.stage === 3, onUse: () => boardAndFly() });
    async function boardAndFly() {
      S.stage = 4;
      const P = Game.player, pm = P.model;
      startEngine(); board('halm', 1); board('lena', 2); board('diego', 4);
      heli.userData.openDoor(true);
      const loc = (x, y, z) => () => heli.localToWorld(V(x, y, z));
      const from = pm.position.clone(), doorW = V(DOOR_OUT.x + 0.4, 0, DOOR_OUT.z);
      await Cine.play([
        { from: V(31.5, 2.4, 9.5), to: V(32.8, 2.6, 8.8), look: V(42.5, 1.9, 3.6), dur: 3.4, cut: true, fov: 50,
          onStart: () => { pm.visible = true; HUD.say([{ who: 'Лукас', text: 'Все на борту? Отлично. Пристёгиваемся!', dur: 2.8 }]); },
          onUpdate: (k, dt) => { pm.position.lerpVectors(from, doorW, clamp(k * 1.3, 0, 1)); pm.rotation.y = Math.atan2(doorW.x - from.x, doorW.z - from.z); pm.userData.anim(dt, k < 0.75 ? 3.2 : 0, {}); } },
        { from: loc(-0.25, 2.3, -1.55), to: loc(-0.2, 2.28, -1.35), look: loc(0.25, 1.85, 2.6), dur: 5.6, cut: true, fov: 56,
          onStart: () => { heli.userData.seat(pm, 3); heli.userData.cabinLight.intensity = 0.6; HUD.say([{ who: 'Хальм', text: '«Порог», Дельта-пять к вылету готова.', dur: 2.6 }, { who: 'Нора (радио)', text: 'Дельта-пять, «Порог». Взлёт разрешаю. Удачи вам.', dur: 2.8 }]); },
          onUpdate: (k, dt) => pm.userData.anim(dt, 0, { sit: true }) },
        { from: loc(0.1, 2.12, 1.8), look: loc(0.6, 2.02, 0.85), dur: 3.4, cut: true, fov: 42,
          onStart: () => HUD.say([{ who: 'Лена', text: '<em>(тихо)</em> Пять видов. Пять образцов. Ничего сложного.', dur: 3.2 }]),
          onUpdate: (k, dt) => pm.userData.anim(dt, 0, { sit: true }) },
        { from: V(37.5, 1.6, -1.5), look: loc(1.3, 1.7, 0.4), dur: 2.4, cut: true, fov: 48, onStart: () => { heli.userData.openDoor(false); Sound.sfx('door', 0.8); } },
        { from: V(31.5, 3.2, 12.5), to: V(32.2, 3.8, 11.6), look: () => heli.position.clone().add(V(0, 2, 0)), dur: 7, cut: true, fov: 50,
          onStart: () => { Cam.shake = 0.15; HUD.say([{ who: 'Лукас', text: 'Дельта-пять, взлёт.', dur: 2 }]); },
          onUpdate: (k) => { const e = ease(k); heli.position.set(HPX + k * k * 36, e * 14 + k * k * 12, HPZ - k * k * 18); heli.rotation.set(-0.12 * smoothstep(0.2, 0.7, k), Math.PI - smoothstep(0.1, 0.9, k) * 1.25, Math.sin(k * 3) * 0.03); } },
      ], { skippable: true });
      await HUD.fade(1, 1.0);
      Game.complete('valley', { flight: true });
    }
    // ---------- optional conversations and clues ----------
    world.interact({
      x: -7.8, z: 5.6, r: 1.9, label: 'Осмотреть ящик', enabled: () => !S.box,
      onUse: () => { S.box = true; HUD.say([{ who: '[Ящик]', text: '«D-04 — PERSONAL EFFECTS — UNCLAIMED». Внутри шляпа и детский рисунок: остров и подпись «Маме».', dur: 5 }, { who: 'Итан', text: 'D-04. Значит, были и D-01, D-02, D-03.', dur: 3 }]); Game.state.flags.clueBox = true; },
    });
    world.interact({
      x: -8.2, z: -1, r: 1.8, label: 'Осмотреть дверь', enabled: () => !S.ark,
      onUse: () => { S.ark = true; HUD.say([{ who: '[Дверь]', text: 'Заперто. «ARK MIRROR — RESTRICTED». Сквозь стекло видны серверные стойки. Кто-то изнутри опускает жалюзи.', dur: 5 }]); Game.state.flags.clueArk = true; },
    });
    world.interact({ x: 3.6, z: 2.4, r: 1.7, label: 'Поговорить с Лукасом', npc: 'lucas', enabled: () => !S.lucas && S.stage >= 0 && S.stage <= 1, onUse: () => { S.lucas = true; HUD.say([{ who: 'Лукас', text: 'Следопыт! Над этим островом никто не летал. Вокруг — сколько угодно, там приборы сходят с ума.', dur: 4.2 }, { who: 'Лукас', text: 'Так что, если что, я просто очень уверенно поверну обратно.', dur: 3.2 }]); } });
    world.interact({ x: -3.6, z: -1.3, r: 1.7, label: 'Поговорить с Леной', npc: 'lena', enabled: () => !S.lena && S.stage === 0, onUse: () => { S.lena = true; HUD.say([{ who: 'Лена', text: 'Я всю жизнь собирала ДНК из костей. Это как читать книгу по обгоревшим страницам.', dur: 4 }, { who: 'Лена', text: 'А там… там книги живые.', dur: 2.6 }]); } });
    world.interact({ x: 5.4, z: -1.3, r: 1.7, label: 'Поговорить с Диего', npc: 'diego', enabled: () => !S.diego && S.stage >= 0 && S.stage <= 1, onUse: () => { S.diego = true; HUD.say([{ who: 'Диего', text: 'Двенадцать патронов. Больше не дам — там патроны не растут.', dur: 3.2 }, { who: 'Диего', text: 'Ракеты — твой лучший друг. Пули только злят то, что больше тебя.', dur: 3.6 }]); } });
    world.interact({ x: 8.1, z: 2.7, r: 1.6, label: 'Поговорить с Юсуфом', npc: 'yusuf', enabled: () => !S.yusuf && S.stage >= 0 && S.stage <= 1, onUse: () => { S.yusuf = true; HUD.say([{ who: 'Юсуф', text: 'Кейс проверен трижды. Если огонёк зелёный — образец живой. Если жёлтый — ищите дальше.', dur: 4.4 }]); } });
    return ctx;
  },
};
