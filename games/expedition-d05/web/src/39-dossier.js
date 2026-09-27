// ============================================================
// 39-dossier.js — the briefing's field footage: one living set on the island for each species
//
// Halm names the five species over the holotable. The camera dives into the holographic island
// and the briefing cuts to D-04's footage of each animal where the expedition will find it: the
// herd on the meadow (brachiosaurs behind it), raptors in the ruins of K-4, the Spinosaurus in a
// river under its waterfall, Pteranodons over the sea cliffs, and the Queen in a storm.
//
// It is a small World of its own, with its own scene, sky, fog and light. The prologue shows it
// by putting its scene in place of the station's for those shots (show(true)) and taking it
// back after (show(false)); its updaters run only while it is on screen.
// ============================================================
const DOSSIER_ORDER = ['tri', 'rap', 'spi', 'pte', 'rex'];
const DOS = { tri: { x: 0, z: 0 }, rap: { x: -150, z: 40 }, spi: { x: 150, z: 20 }, pte: { x: 0, z: 178 }, rex: { x: -140, z: -70 } };
const dosRiverX = (z) => 150 + Math.sin((z + 58) * 0.025) * 8;
// above the falls: the stream comes down from the northern range along the top of a rock mesa
const dosStreamX = (z) => 150 + Math.sin((z + 60) * 0.045) * 4;
const DOS_LIP = 20.5; // the stream bed at the lip of the falls
const dosStreamBed = (z) => DOS_LIP + Math.max(0, -62 - z) * 0.32;

function dossierHeight(x, z) {
  let h = 2.6 + fbm(x * 0.017, z * 0.017, 4) * 3.4 + fbm(x * 0.06, z * 0.06, 2) * 0.6;
  // ridged mountains to the north (behind the meadow) and the west (behind the ruins)
  const range = Math.max(smoothstep(-85, -190, z), smoothstep(-205, -285, x));
  if (range > 0) { const r = 1 - Math.abs(fbm(x * 0.009 + 4, z * 0.009 - 2, 5)); h += range * (26 + r * r * 92); }
  const d = (p) => Math.hypot(x - p.x, z - p.z);
  // the meadow stays gentle; the ruins sit on a low rise; the Queen's clearing is flat
  h = lerp(h, 2.4 + fbm(x * 0.05, z * 0.05, 2) * 0.7, Math.exp(-(d(DOS.tri) ** 2) / (2 * 48 * 48)));
  h += 5 * Math.exp(-(d(DOS.rap) ** 2) / (2 * 30 * 30));
  h = lerp(h, 3, Math.exp(-(d(DOS.rex) ** 2) / (2 * 20 * 20)));
  // The river has a source you can see: a stream comes down from the northern range, runs along
  // the top of a rock mesa and falls off its south face (z = -60) into a pool; from the pool the
  // channel runs to the sea.
  const mesa = Math.exp(-((x - 150) ** 2) / (2 * 22 * 22)) * smoothstep(-56, -63, z);
  h = Math.max(h, lerp(h, dosStreamBed(Math.min(z, -62)) + 2.2 + fbm(x * 0.08, z * 0.08, 2) * 1.2, mesa));
  if (z < -60) { const bed = dosStreamBed(z), k = Math.exp(-((x - dosStreamX(z)) ** 2) / (2 * 3.2 * 3.2)); if (h > bed) h = lerp(h, bed, k); }
  if (z > -62) h = lerp(h, -2.8, Math.exp(-((x - dosRiverX(z)) ** 2) / (2 * 6.5 * 6.5)) * smoothstep(-62, -54, z));
  // the southern plateau and its cliffs, then the sea
  h += smoothstep(118, 148, z) * (1 - smoothstep(92, 120, Math.abs(x))) * (32 + fbm(x * 0.05, z * 0.05, 2) * 3);
  h = lerp(h, -14, smoothstep(190, 206, z));
  h = lerp(h, -14, smoothstep(258, 300, x));
  return h;
}
function dossierColor(x, z, y, slope, c) {
  const n = fbm(x * 0.06, z * 0.06, 3) * 0.5 + 0.5;
  if (y < -1.0) c.set('#4a4636');
  else if (y < 0.6) c.set(z > 170 ? '#b8a77e' : '#6d624a');
  else { c.set('#4f6a33').lerp(_tmpC.set('#2f4624'), n); if (fbm(x * 0.14, z * 0.14, 2) > 0.3) c.lerp(_tmpC.set('#7d7a45'), 0.35); }
  if (slope > 0.28) c.lerp(_tmpC.set('#6c6a5e'), smoothstep(0.28, 0.55, slope));
  if (y > 45) c.lerp(_tmpC.set('#5a5a52'), smoothstep(45, 110, y) * 0.7);
}

// sky, fog, light and grade for each set; applied on the cut, not eased
const DOS_LOOKS = {
  day: { top: '#3f7fcf', hor: '#d8e6e4', low: '#86a09a', sunCol: '#fff0d0', cover: 0.34, cloud: '#f6f7f8', cloudDark: 0.3, sunDir: [-0.45, 0.58, 0.62], fog: ['#b6c8c6', 70, 460], sky: '#c4dcee', ground: '#56603a', hemi: 1.35, sun: 3.3,
    grade: { exposure: 1.03, contrast: 1.08, saturation: 1.16, lift: '#040608', gain: '#fff8ec', vignette: 0.95, bloom: 0.5 } },
  jungle: { top: '#4c7fb8', hor: '#b8cbb8', low: '#5c6e58', sunCol: '#fff2cc', cover: 0.5, cloud: '#eef2ea', cloudDark: 0.35, sunDir: [0.35, 0.8, 0.3], fog: ['#6f8866', 16, 140], sky: '#9fbf96', ground: '#2e3a22', hemi: 1.0, sun: 2.4,
    grade: { exposure: 1.0, contrast: 1.12, saturation: 1.12, lift: '#020604', gain: '#eefde4', vignette: 1.15, bloom: 0.55 } },
  river: { top: '#4a82c0', hor: '#dbe4de', low: '#8a9c96', sunCol: '#fff4dc', cover: 0.42, cloud: '#f3f5f5', cloudDark: 0.3, sunDir: [0.5, 0.5, -0.7], fog: ['#c2cfcb', 35, 300], sky: '#c6d8e4', ground: '#4a5634', hemi: 1.3, sun: 3.0,
    grade: { exposure: 1.02, contrast: 1.07, saturation: 1.1, lift: '#040608', gain: '#fbfaf2', vignette: 0.95, bloom: 0.55 } },
  cliffs: { top: '#3b64a6', hor: '#f4c08c', low: '#8a7a70', sunCol: '#ffc98a', cover: 0.3, cloud: '#f6d2b0', cloudDark: 0.4, sunDir: [-0.72, 0.15, 0.68], fog: ['#d8b89a', 90, 620], sky: '#b8c4dc', ground: '#5a5038', hemi: 1.15, sun: 3.0,
    grade: { exposure: 1.02, contrast: 1.08, saturation: 1.12, lift: '#070504', gain: '#fff0dc', vignette: 0.95, bloom: 0.7 } },
  storm: { top: '#171d24', hor: '#343e46', low: '#1a1f23', sunCol: '#8a98a8', cover: 0.96, cloud: '#3e4852', cloudDark: 0.65, sunDir: [-0.3, 0.7, 0.4], fog: ['#262e34', 10, 110], sky: '#56626e', ground: '#15191a', hemi: 0.5, sun: 0.35,
    grade: { exposure: 1.1, contrast: 1.16, saturation: 0.8, lift: '#03060a', gain: '#e4eef6', vignette: 1.2, bloom: 0.5 } },
};

function makeDossier(station) {
  seed(3131);
  const isle = new World();
  const H = (x, z) => dossierHeight(x, z);
  const L3 = (a, b, c) => GFX.pick([a, b, c, Math.round(c * 1.35)]);
  makeTerrain(isle, { size: 640, seg: 150, cz: 20, height: H, color: dossierColor });
  makeWater(isle, { y: -1.2, size: 2400, color: '#3f6d68' });
  const L0 = DOS_LOOKS.day;
  isle.scene.fog = new THREE.Fog(L0.fog[0], L0.fog[1], L0.fog[2]);
  const sky = makeSky(isle, { top: L0.top, horizon: L0.hor, low: L0.low, sunDir: new THREE.Vector3(...L0.sunDir), sunColor: L0.sunCol, cover: L0.cover, cloud: L0.cloud, cloudDark: L0.cloudDark });
  const hemi = new THREE.HemisphereLight(L0.sky, L0.ground, L0.hemi); isle.add(hemi);
  const sun = new THREE.DirectionalLight(L0.sunCol, L0.sun);
  sun.castShadow = true;
  const ms = GFX.pick([512, 1024, 2048, 4096]); sun.shadow.mapSize.set(ms, ms);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 400 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  isle.add(sun); isle.add(sun.target);
  isle.hemi = hemi; isle.baseHemi = L0.hemi; isle.sun = sun;
  const rain = makeRain(isle); rain.visible = false;
  const focus = new THREE.Vector3(), sunDir = new THREE.Vector3();
  const look = (k, at) => {
    const L = DOS_LOOKS[k], u = sky.material.uniforms;
    u.top.value.set(L.top); u.hor.value.set(L.hor); u.low.value.set(L.low); u.sunCol.value.set(L.sunCol);
    u.cover.value = L.cover; u.cloudCol.value.set(L.cloud); u.cloudDark.value = L.cloudDark; u.flash.value = 0;
    sunDir.set(...L.sunDir).normalize(); u.sunDir.value.copy(sunDir);
    isle.scene.fog.color.set(L.fog[0]); isle.scene.fog.near = L.fog[1]; isle.scene.fog.far = L.fog[2];
    hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = isle.baseHemi = L.hemi;
    sun.color.set(L.sunCol); sun.intensity = L.sun;
    focus.set(at.x, H(at.x, at.z), at.z);
    sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 150);
    rain.visible = k === 'storm';
    Post.setGrade(L.grade, true);
  };

  // ---------- vegetation ----------
  const inSet = (x, z, r) => Object.values(DOS).some((p) => Math.hypot(x - p.x, z - p.z) < r);
  // each shot's camera and what it looks at: trees and bushes keep out of that line
  const sight = [[-15, 19, 0, -4], [DOS.rap.x + 9, DOS.rap.z + 10, DOS.rap.x - 1, DOS.rap.z - 5], [dosRiverX(36) + 5, 36, dosRiverX(12), 12], [60, 180, 30, 196], [DOS.rex.x + 4, DOS.rex.z + 16, DOS.rex.x, DOS.rex.z - 16]];
  const inSight = (x, z, r = 4.5) => sight.some(([ax, az, bx, bz]) => { const dx = bx - ax, dz = bz - az, k = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(x - ax - dx * k, z - az - dz * k) < r; });
  const onRiver = (x, z) => (z > -64 && Math.abs(x - dosRiverX(z)) < 10) || (z <= -60 && z > -160 && Math.abs(x - dosStreamX(z)) < 6);
  const land = (x, z, lo = 0.8, hi = 70) => { const h = H(x, z); return h > lo && h < hi; };
  const con = scatter(L3(260, 420, 600), () => {
    const x = rnd(-300, 300), z = rnd(-280, 140);
    const h = H(x, z);
    if (h < 3 || h > 85 || onRiver(x, z) || inSet(x, z, 26) || inSight(x, z, 8)) return null;
    // mostly on the slopes and in the Queen's forest; a few on the meadow's far edge
    const slope = Math.max(smoothstep(-70, -120, z), smoothstep(-190, -230, x)), forest = Math.hypot(x - DOS.rex.x, z - DOS.rex.z) < 70;
    if (!forest && rng() > slope * 0.9 + 0.05) return null;
    return { x, y: h - 0.2, z, s: rnd(1.2, 2.4), ry: rnd(0, TAU) };
  });
  scatterInstanced(isle, coniferGeo(), vegMat(0.0025), con, { cast: true, chunk: 120, tints: TREE_TINTS });
  for (let v = 0; v < 3; v++) {
    const bl = scatter(L3(40, 70, 100), () => {
      // the jungle round the ruins is dense; the meadow is ringed; the river banks are wooded
      const pick3 = rng();
      let x, z;
      if (pick3 < 0.45) { const a = rnd(0, TAU), r = rnd(12, 75); x = DOS.rap.x + Math.cos(a) * r; z = DOS.rap.z + Math.sin(a) * r; }
      else if (pick3 < 0.8) { const a = rnd(0, TAU), r = rnd(55, 140); x = DOS.tri.x + Math.cos(a) * r; z = DOS.tri.z + Math.sin(a) * r * 0.8; }
      else { z = rnd(-40, 150); x = dosRiverX(z) + (rng() < 0.5 ? -1 : 1) * rnd(12, 40); }
      if (!land(x, z, 1, 40) || onRiver(x, z) || inSet(x, z, 9) || inSight(x, z, 7)) return null;
      return { x, y: H(x, z) - 0.2, z, s: rnd(0.9, 1.5), ry: rnd(0, TAU) };
    });
    scatterInstanced(isle, broadleafGeo(v + 1), leafMat(0.006), bl, { cast: true, low: broadleafGeo(v + 1, 0), lowD: 80, tints: TREE_TINTS });
    const bu = scatter(L3(40, 70, 110), () => { const x = rnd(-220, 220), z = rnd(-80, 170); if (!land(x, z, 1, 40) || onRiver(x, z) || inSet(x, z, 7) || inSight(x, z)) return null; return { x, y: H(x, z) - 0.1, z, s: rnd(0.7, 1.5), ry: rnd(0, TAU) }; });
    scatterInstanced(isle, bushGeo(v + 1), leafMat(0.01), bu, { cast: false, low: bushGeo(v + 1, 0), lowD: 50, tints: TREE_TINTS });
  }
  const tf = scatter(L3(40, 60, 90), () => {
    const nearR = rng() < 0.5, z = rnd(-50, 120);
    const x = nearR ? dosRiverX(z) + (rng() < 0.5 ? -1 : 1) * rnd(8, 22) : DOS.rap.x + rnd(-40, 40);
    const zz = nearR ? z : DOS.rap.z + rnd(-40, 40);
    if (!land(x, zz, 0.5, 30) || onRiver(x, zz) || inSet(x, zz, 7) || inSight(x, zz, 6)) return null;
    return { x, y: H(x, zz) - 0.1, z: zz, s: rnd(0.9, 1.5), ry: rnd(0, TAU) };
  });
  scatterInstanced(isle, treeFernGeo(), vegMat(0.01), tf, { cast: true, tints: TREE_TINTS });
  scatterInstanced(isle, cycadGeo(), vegMat(0.02), scatter(L3(40, 70, 100), () => { const x = rnd(-200, 200), z = rnd(-60, 160); if (!land(x, z, 0.6, 30) || onRiver(x, z) || inSet(x, z, 6) || inSight(x, z)) return null; return { x, y: H(x, z) - 0.1, z, s: rnd(0.8, 1.4), ry: rnd(0, TAU) }; }), { cast: true, tints: TREE_TINTS });
  makePalms(isle, scatter(L3(10, 16, 24), () => { const z = rnd(-30, 160), x = dosRiverX(z) + (rng() < 0.5 ? -1 : 1) * rnd(8, 14); if (!land(x, z, 0.3, 8)) return null; return { x, y: H(x, z) - 0.1, z, s: rnd(0.9, 1.3), ry: rnd(0, TAU) }; }));
  makeFerns(isle, scatter(L3(500, 900, 1400), () => {
    const k = pick(['tri', 'tri', 'rap', 'rap', 'spi', 'rex']), p = DOS[k], a = rnd(0, TAU), r = rnd(3, k === 'tri' ? 40 : 30);
    const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    if (!land(x, z, 0.4, 30) || onRiver(x, z) || inSight(x, z, k === 'rap' ? 2.6 : 1.5)) return null;
    return { x, y: H(x, z) - 0.05, z, s: rnd(0.7, 1.6), ry: rnd(0, TAU), tint: pick(['#6f9a45', '#5c8a3a', '#88a452']) };
  }), { far: 120 });
  // meadow grass: a static field in front of the herd (the game's grass follows the player)
  {
    const gm = windMaterial(new THREE.MeshLambertMaterial({ map: grassTexture(), alphaTest: 0.5, side: THREE.DoubleSide }), 0.5);
    const list = scatter(L3(1200, 2400, 3600), () => { const a = rnd(0, TAU), r = Math.sqrt(rng()) * 34; const x = -8 + Math.cos(a) * r, z = 8 + Math.sin(a) * r; if (!land(x, z, 0.8, 12)) return null; const s = rnd(0.7, 1.3); return { x, y: H(x, z) - 0.04, z, s, sy: rnd(0.8, 1.4), ry: rnd(0, TAU), tint: pick(['#6a8a4a', '#5f7f42', '#748f50', '#7f8a4e']) }; });
    scatterInstanced(isle, grassGeometry(), gm, list, { cast: false, chunk: 0 });
  }

  // ---------- rocks, ruins, the river's source ----------
  const rockM = new THREE.MeshStandardMaterial({ color: '#7a786c', roughness: 0.92, flatShading: true, envMapIntensity: 0.4 });
  const rocks = new THREE.Group();
  [[141, -61, 6, 9], [159, -61, 6, 8], [134, -60, 4, 5], [166, -59, 4, 4], [145, -66, 3, 2], [156, -67, 3, 2], [dosRiverX(-20) + 9, -20, 2.4, 1.6], [dosRiverX(30) - 10, 30, 2, 1.4], [-10, 150, 3, 2.4], [22, 160, 2.6, 2], [-162, 30, 2.2, 1.6], [12, -26, 2, 1.4], [-24, -12, 1.6, 1.1]].forEach(([x, z, s, sy], i) => {
    mesh(rockGeo(i + 40), rockM, { parent: rocks, pos: [x, H(x, z) + sy * 0.25, z], rot: [rnd(0, 0.3), rnd(0, TAU), 0], scale: [s * 1.2, sy, s], receive: true });
  });
  isle.add(bakeRig(rocks));
  // the waterfall: the stream on the mesa, the sheet off the lip, foam and spray in the pool below
  const streamPts = [];
  for (let i = 0; i <= 40; i++) { const z = lerp(-150, -60.2, i / 40); streamPts.push([dosStreamX(z), dosStreamBed(z) + 0.45, z, 4.2]); }
  makeStream(isle, streamPts, { speed: 0.9 });
  makeFalls(isle, { x: dosStreamX(-60.2), z: -60.2, top: DOS_LIP + 0.45, bottom: -1.2, width: 4.2, sound: false });
  // K-4's outer ruins: a broken wall with the station stencil, a fallen slab, fence posts
  {
    const parts = [], gx = DOS.rap.x, gz = DOS.rap.z, gy = H(gx, gz);
    const P = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0) => parts.push({ geo, color, m: M4(x, y, z, rx, ry, rz) });
    P(G.box(9, 3.4, 0.5), '#8a877a', gx - 4, gy + 1.5, gz - 8, 0, 0.35, 0);
    P(G.box(3.2, 2.2, 0.5), '#7e7b70', gx + 2.2, gy + 0.9, gz - 6.4, 0.05, 0.35, 0.25);
    P(G.box(4, 1.0, 3.2), '#85826f', gx - 2, gy + 0.3, gz - 5, 0.08, -0.2, 0.04);
    P(G.box(2.4, 0.8, 1.8), '#77746a', gx + 4.5, gy + 0.2, gz - 1.5, 0.12, 0.6, -0.1);
    for (let i = 0; i < 6; i++) P(G.cyl(0.04, 0.05, 2.2, 5), '#5a4030', gx - 12 + i * 2.2, gy + 1.0, gz - 10.5 - i * 0.4, 0, 0, i === 3 ? 0.9 : rnd(-0.1, 0.1));
    for (let i = 0; i < 5; i++) P(G.cyl(0.02, 0.02, 1.6, 4), '#5a3a2a', gx - 6.5 + i * 0.6, gy + 3.3, gz - 8.2 + i * 0.2, rnd(-0.4, 0.4), 0, rnd(-0.4, 0.4));
    const ruin = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, envMapIntensity: 0.4 }));
    ruin.castShadow = true; ruin.receiveShadow = true; isle.add(ruin);
    const stencil = canvasTex(256, 96, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(40,36,30,0.85)'; g.font = 'bold 64px Arial Narrow, Arial'; g.textAlign = 'center'; g.fillText('K-4', w / 2, 70); });
    mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: stencil, transparent: true, depthWrite: false }), { parent: isle.scene, pos: [gx - 4 + Math.sin(0.35) * 0.27, gy + 2.1, gz - 8 + Math.cos(0.35) * 0.27], rot: [0, 0.35, 0], cast: false });
  }
  // cloud banks the opening shot descends through
  const cloudTex = canvasTex(128, 128, (g, w, h) => { for (let i = 0; i < 9; i++) { const x = rnd(30, 98), y = rnd(40, 88), r = rnd(18, 34); const gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
  const cloudM = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(cloudM); const t = rnd(0, 1); s.position.set(lerp(70, 20, t) + rnd(-40, 40), lerp(150, 95, t) + rnd(-10, 10), lerp(170, 70, t) + rnd(-40, 40)); s.scale.setScalar(rnd(40, 80)); isle.scene.add(s); }

  // ---------- animals ----------
  const at = (o, x, z, ry = 0, dy = 0) => { o.position.set(x, H(x, z) + dy, z); o.rotation.y = ry; isle.add(o); return o; };
  const herd = [
    at(makeTriceratops(), 1, -2, 2.3), at(makeTriceratops({ broken: true }), -9, -9, 1.1), at(makeTriceratops(), 12, -6, 4.2), at(makeTriceratops({ scale: 0.5 }), -3, -5, 2.0),
  ];
  const walker = herd[2];
  const brachios = [at(makeBrachio(), 26, -62, 0.9, -0.6), at(makeBrachio(), 46, -76, 2.4, -0.6)];
  const rapA = at(makeRaptor(), DOS.rap.x - 2, DOS.rap.z - 5, 0.35, 1.0), rapB = at(makeRaptor({ notch: true }), DOS.rap.x + 8, DOS.rap.z + 3, -Math.PI / 2);
  const spino = makeSpino(); spino.position.set(dosRiverX(12), -2.8, 12); spino.rotation.y = 0.15; isle.add(spino);
  const pteras = [0, 1, 2, 3].map((i) => { const p = makePtera({ scale: 1.3 }); isle.add(p); p.userData.orbit = { r: 9 + i * 4.5, y: H(20, 190) + 5 + i * 3, w: (i % 2 ? -1 : 1) * (0.42 - i * 0.05), a: i * 1.7 }; return p; });
  const rex = at(makeRex(), DOS.rex.x, DOS.rex.z - 16, 0);
  const rexZ0 = rex.position.z;
  const S = { t: 0, set: null, flashT: -1 };
  isle.onUpdate((dt) => {
    S.t += dt;
    const t = S.t;
    herd.forEach((h, i) => { if (h !== walker) h.userData.anim(dt, 0, { graze: Math.sin(t * 0.5 + i * 2) > -0.4, look: Math.sin(t * 0.3 + i) * 0.3 }); });
    walker.position.x += dt * 0.9 * Math.sin(walker.rotation.y); walker.position.z += dt * 0.9 * Math.cos(walker.rotation.y); walker.position.y = H(walker.position.x, walker.position.z);
    walker.userData.anim(dt, 0.9, {});
    brachios.forEach((b, i) => { b.userData.drinking = false; b.userData.anim(dt, 0); b.userData.neck.rotation.y = Math.sin(t * 0.2 + i * 2) * 0.35; });
    rapA.userData.anim(dt, 0, { tilt: Math.sin(t * 1.3) > 0, alert: true, open: Math.sin(t * 0.9) > 0.8 });
    rapB.position.x -= dt * 2.4; rapB.position.y = H(rapB.position.x, rapB.position.z);
    rapB.userData.anim(dt, 2.4, { crouch: true, sniff: true });
    spino.userData.anim(dt, 0, { lunge: Math.sin(t * 0.6) > 0.6, open: Math.sin(t * 1.1) > 0.7 });
    spino.position.y = -2.8 + Math.sin(t * 0.8) * 0.05;
    pteras.forEach((p, i) => {
      const o = p.userData.orbit, a = o.a + t * o.w, cx = 38, cz = 193;
      p.position.set(cx + Math.cos(a) * o.r, o.y + Math.sin(t * 0.7 + i) * 1.5, cz + Math.sin(a) * o.r);
      // heading along the circle (the model faces +Z), banked into the turn
      const sg = Math.sign(o.w);
      p.rotation.set(0, Math.atan2(-Math.sin(a) * sg, Math.cos(a) * sg), sg * 0.35);
      p.userData.anim(dt, 0, { flap: Math.sin(t * 0.8 + i * 1.9) > 0.55 });
    });
    if (S.set === 'rex') { rex.position.z = Math.min(rexZ0 + 7, rex.position.z + dt * 1.7); rex.position.y = H(rex.position.x, rex.position.z); }
    rex.userData.anim(dt, S.set === 'rex' && rex.position.z < rexZ0 + 7 ? 1.7 : 0, { look: 0.15 });
    if (S.flashT >= 0) {
      S.flashT += dt;
      const v = [1, 0.25, 0.9, 0][Math.min(3, Math.floor(S.flashT / 0.07))];
      hemi.intensity = isle.baseHemi + v * 6; sky.material.uniforms.flash.value = v * 0.6;
      if (S.flashT > 0.3) { S.flashT = -1; hemi.intensity = isle.baseHemi; sky.material.uniforms.flash.value = 0; }
    }
    // the footage counter in the corner
    const tc = $('footTime'); if (tc) { const s = Math.floor(t), f = Math.floor((t - s) * 25); tc.textContent = `00:${String(14 + Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f).padStart(2, '0')}`; }
  });
  station.onUpdate((dt) => { if (D.on) { isle.update(dt); isle.cull(camera); } });
  // compile its shaders now, behind the loading screen, not on the first cut to the island
  try { renderer.compile(isle.scene, camera); } catch (e) { /* compile is only a warm-up */ }

  let saved = null;
  const D = {
    isle, on: false, setLook: look,
    show(on) {
      if (on === D.on) return;
      D.on = on;
      if (on) { saved = station.scene; station.scene = isle.scene; $('footage').hidden = false; }
      else { station.scene = saved; $('footage').hidden = true; HUD.dossier(null); Post.setGrade(station.grade, true); }
    },
    // the shots between the holotable and the return to the briefing room. sayName(k) says the
    // species' line; each set also marks the station screen so the room is up to date on return.
    shots({ sayName, mark }) {
      const G0 = (x, z, dy) => V(x, H(x, z) + dy, z);
      const set = (k, lookName, at) => () => { S.set = k; look(lookName, at); };
      const species = (k, i, lookName, from, to, lookAt, dur, extra) => ({
        from, to, look: lookAt, dur, cut: true, fov: extra.fov || 42,
        onStart: () => {
          set(k, lookName, extra.at || DOS[k])();
          if (extra.onStart) extra.onStart();
          HUD.dossier(k, i);
          mark(i + 1);
          sayName(k);
        },
        onUpdate: extra.onUpdate,
      });
      return [
        // down through the clouds onto the island
        { from: V(80, 158, 190), to: V(18, 40, 58), look: () => V(0, 4, -12), dur: 3.4, cut: true, fov: 50,
          onStart: () => { D.show(true); S.set = 'dive'; look('day', DOS.tri); Sound.bed('hum', 0, 0.6); Sound.bed('rain', 0, 0.6); Sound.bed('wind', 0.1, 0.8); Sound.bed('insects', 0.035, 2); Sound.sfx('whistle', 0.25); } },
        species('tri', 0, 'day', G0(-17, 19, 1.4), G0(-13, 14.5, 1.3), () => V(0, H(0, -4) + 2.2, -4), 3.8, { onStart: () => { Sound.bird(0.03, -0.4); setTimeout(() => Sound.sfx('horn', 0.35), 900); } }),
        species('rap', 1, 'jungle', G0(DOS.rap.x + 6.5, DOS.rap.z + 5.5, 1.25), G0(DOS.rap.x + 4.8, DOS.rap.z + 3.6, 1.15), () => V(rapA.position.x, rapA.position.y + 1.7, rapA.position.z), 3.8,
          { fov: 40, onStart: () => { rapB.position.set(DOS.rap.x + 9, H(DOS.rap.x + 9, DOS.rap.z + 3), DOS.rap.z + 3); Sound.bed('insects', 0.05, 0.3); setTimeout(() => Sound.sfx('click', 0.5), 600); } }),
        species('spi', 2, 'river', V(dosRiverX(36) + 5.5, 0.25, 36), V(dosRiverX(33) + 4.5, 0.45, 33), V(dosRiverX(8), 3.6, 4), 3.8, { fov: 46, at: { x: dosRiverX(12), z: 12 }, onStart: () => { Sound.bed('water', 0.1, 0.4); Sound.bed('insects', 0.02, 0.4); Sound.sfx('splash', 0.5); } }),
        species('pte', 3, 'cliffs', G0(62, 178, 2.2), G0(58, 181, 2.8), () => V(30, H(30, 190) + 7, 196), 3.8, { fov: 52, at: { x: 35, z: 190 }, onStart: () => { Sound.bed('water', 0.04, 0.6); Sound.bed('wind', 0.14, 0.6); setTimeout(() => Sound.sfx('shriek', 0.45), 700); } }),
        // the storm comes in over the forest: silence, one footfall
        { from: G0(DOS.rex.x + 5, DOS.rex.z + 16, 1.7), to: G0(DOS.rex.x + 4, DOS.rex.z + 13, 1.6), look: () => V(DOS.rex.x, H(DOS.rex.x, DOS.rex.z) + 3.5, DOS.rex.z - 20), dur: 2.4, cut: true, fov: 46,
          onStart: () => { S.set = 'still'; rex.visible = false; look('storm', DOS.rex); HUD.dossier(null); Sound.silenceAll(0.4); setTimeout(() => { Sound.sfx('thud', 0.7); Cam.shake = Math.max(Cam.shake, 0.25); }, 1400); } },
        species('rex', 4, 'storm', G0(DOS.rex.x + 4, DOS.rex.z + 6, 1.1), G0(DOS.rex.x + 3.6, DOS.rex.z + 4.5, 1.0), () => V(rex.position.x, rex.position.y + 5.2, rex.position.z + 2), 3.8,
          { fov: 44, onStart: () => { rex.visible = true; S.flashT = 0; Sound.sfx('thunder', 0.9); Sound.bed('rain', 0.12, 0.3); Sound.sfx('thud', 0.9); Sound.tone(49, 2.5, 'sawtooth', 0.12, 0, 41); } }),
      ];
    },
    dispose() { D.show(false); isle.dispose(); },
  };
  return D;
}
