// ============================================================
// 20-world.js — world container, sky, terrain, vegetation, fx
// ============================================================
const WindU = { value: 0 };
const _cullV = new THREE.Vector3();

class World {
  constructor(opts = {}) {
    this.scene = new THREE.Scene();
    this.circles = [];     // {x,z,r}
    this.boxes = [];       // {x0,x1,z0,z1,y0?,y1?}
    this.interactables = [];
    this.updaters = [];
    this.waterY = -1e9;
    this.bounds = opts.bounds || null; // {x,z,r} circle
    this.terrain = null;
    this.floor = opts.floor ?? null; // function(x,z)=>y for indoor
    this.wind = new THREE.Vector2(1, 0);
    this.noiseListeners = [];
  }
  add(o) {
    this.scene.add(o);
    if (o.userData && o.userData.castKey && !o.userData.isPlayer) { this.cast ||= []; if (!this.cast.includes(o)) this.cast.push(o); }
    if (o.userData && o.userData.lodFar) (this.lods ||= []).push(o);
    if (o.userData && (o.userData.far || o.userData.lowGeo)) (this.farCull ||= []).push(o);
    return o;
  }
  // per-frame visibility by distance: small scatter cells beyond their draw distance are skipped,
  // and herd animals far away swap their rig for a single merged mesh (see rigLOD)
  cull(cam) {
    cam.getWorldPosition(_cullV);
    const px = _cullV.x, pz = _cullV.z;
    if (this.farCull) for (const g of this.farCull) {
      const u = g.userData, far = u.far || Infinity;
      for (const c of g.children) {
        const s = c.boundingSphere; if (!s) continue;
        const d = Math.hypot(s.center.x - px, s.center.z - pz) - s.radius;
        c.visible = d < far;
        if (u.lowGeo) c.geometry = d > u.lowD ? u.lowGeo : u.highGeo;
      }
    }
    if (this.lods) for (const o of this.lods) {
      const e = o.matrixWorld.elements, u = o.userData;
      const f = Math.hypot(e[12] - px, e[14] - pz) > u.lodFar * (u.lodOn ? 0.92 : 1);
      if (f === !!u.lodOn) continue;
      u.lodOn = f; u.lodMesh.visible = f;
      for (const c of u.lodNear) c.visible = !f;
    }
  }
  onUpdate(fn) { this.updaters.push(fn); return fn; }
  update(dt) { for (let i = 0; i < this.updaters.length; i++) this.updaters[i](dt); }
  groundH(x, z) {
    if (this.floor) return this.floor(x, z);
    if (this.terrain) return this.terrain.sample(x, z);
    return 0;
  }
  interact(o) { this.interactables.push({ r: 2.2, hold: 0, enabled: () => true, ...o }); return this.interactables[this.interactables.length - 1]; }
  emitNoise(x, z, radius, kind = 'noise') { for (const l of this.noiseListeners) l(x, z, radius, kind); }
  dispose() { disposeScene(this.scene); if (this.envRT) { this.envRT.dispose(); this.envRT = null; } }
}

// ---------- sky ----------
function makeSky(world, o) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(o.top) }, hor: { value: new THREE.Color(o.horizon) }, low: { value: new THREE.Color(o.low || o.horizon) },
      sunDir: { value: o.sunDir.clone().normalize() }, sunCol: { value: new THREE.Color(o.sunColor || '#fff2d6') }, flash: { value: 0 }, sunSize: { value: o.sunSize ?? 1 },
      time: { value: 0 }, cover: { value: o.cover ?? 0.4 }, cloudCol: { value: new THREE.Color(o.cloud || '#f2f4f6') }, cloudDark: { value: o.cloudDark ?? 0.35 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 low; uniform vec3 sunDir; uniform vec3 sunCol; uniform float flash; uniform float sunSize;
      uniform float time; uniform float cover; uniform vec3 cloudCol; uniform float cloudDark; varying vec3 vDir;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h,0.0,1.0), 0.5)) : mix(hor, low, clamp(-h*4.0,0.0,1.0));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 400.0) * 3.0 * sunSize + pow(s, 12.0) * 0.28);
        if (h > 0.0 && cover > 0.01) {
          vec2 uv = d.xz / (h + 0.14) * 1.7 + vec2(time * 0.006, time * 0.003);
          float n = fbm(uv);
          float cl = smoothstep(1.0 - cover, 1.0 - cover + 0.32, n) * smoothstep(0.0, 0.16, h);
          float lit = 0.5 + 0.5 * pow(s, 2.5);
          vec3 cc = mix(cloudCol * (1.0 - cloudDark), cloudCol, lit) + sunCol * pow(s, 8.0) * 0.25 * (1.0 - cl);
          c = mix(c, cc, cl * 0.93);
        }
        c = mix(c, vec3(0.8, 0.86, 1.0), flash);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1300, 32, 16), m);
  sky.frustumCulled = false; sky.renderOrder = -10;
  world.add(sky);
  world.sky = sky;
  world.onUpdate(() => { sky.position.copy(camera.position); m.uniforms.time.value = Game.time; });
  // image-based light from this sky for standard (PBR) materials; skipped on the lowest level
  if (GFX.level > 0 && !o.noEnv) {
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      const es = new THREE.Scene();
      es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), m));
      const env = pm.fromScene(es, 0.03, 0.1, 50);
      world.scene.environment = env.texture;
      world.envRT = env;
      pm.dispose();
    } catch (e) { /* no float targets: plain lighting */ }
  }
  return sky;
}

function makeLights(world, o) {
  const hemi = new THREE.HemisphereLight(o.skyColor || '#bcd4e6', o.groundColor || '#3b4a2c', o.hemi ?? 1.2);
  world.add(hemi);
  const sun = new THREE.DirectionalLight(o.sunColor || '#fff1d8', o.sun ?? 2.6);
  sun.castShadow = o.shadows !== false;
  const ms = [512, 1024, 2048][GFX.level];
  sun.shadow.mapSize.set(ms, ms);
  const sc = sun.shadow.camera, ext = o.shadowExt ?? 42;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  world.add(sun); world.add(sun.target);
  const dir = o.sunDir.clone().normalize();
  world.sun = sun; world.hemi = hemi; world.sunDir = dir;
  world.baseHemi = hemi.intensity; world.baseSun = sun.intensity;
  world.onUpdate(() => {
    const f = Game.player ? Game.player.pos : camera.position;
    sun.target.position.set(f.x, f.y, f.z);
    sun.position.set(f.x + dir.x * 150, f.y + dir.y * 150, f.z + dir.z * 150);
  });
  return { hemi, sun };
}

// lightning flash
function lightning(world, strength = 1, thunderDelay = 1.2) {
  if (!world.hemi) return;
  const h0 = world.baseHemi;
  let t = 0;
  const seq = [1, 0.2, 0.9, 0];
  const fn = world.onUpdate((dt) => {
    t += dt;
    const i = Math.min(seq.length - 1, Math.floor(t / 0.07));
    const v = seq[i] * strength;
    world.hemi.intensity = h0 + v * 7;
    if (world.sky) world.sky.material.uniforms.flash.value = v * 0.6;
    if (t > 0.3) {
      world.hemi.intensity = h0;
      if (world.sky) world.sky.material.uniforms.flash.value = 0;
      world.updaters.splice(world.updaters.indexOf(fn), 1);
    }
  });
  setTimeout(() => Sound.sfx('thunder', 0.8 * strength), thunderDelay * 1000);
}

// ---------- terrain ----------
function makeTerrain(world, o) {
  const size = o.size, seg = QUALITY ? o.seg : Math.floor(o.seg * 0.75);
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const n1 = seg + 1;
  const heights = new Float32Array(n1 * n1);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (o.cx || 0), z = pos.getZ(i) + (o.cz || 0);
    const y = o.height(x, z);
    pos.setY(i, y);
    heights[i] = y;
  }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (o.cx || 0), z = pos.getZ(i) + (o.cz || 0);
    o.color(x, z, pos.getY(i), 1 - nor.getY(i), c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const det = detailTexture(o.detail || 'grass').clone(); det.needsUpdate = true;
  det.repeat.set(size / (o.tile || 5), size / (o.tile || 5));
  const m = GFX.level > 0
    ? new THREE.MeshStandardMaterial({ vertexColors: true, map: det, bumpMap: det, bumpScale: 0.6, roughness: 0.95, metalness: 0, envMapIntensity: 0.3 })
    : new THREE.MeshLambertMaterial({ vertexColors: true, map: det });
  const t = new THREE.Mesh(geo, m);
  t.position.set(o.cx || 0, 0, o.cz || 0);
  t.receiveShadow = true;
  world.add(t);
  const half = size / 2, step = size / seg;
  const terrain = {
    mesh: t,
    sample(x, z) {
      const gx = (x - (o.cx || 0) + half) / step, gz = (z - (o.cz || 0) + half) / step;
      if (gx < 0 || gz < 0 || gx >= seg || gz >= seg) return o.height(x, z);
      const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
      const a = heights[iz * n1 + ix], b = heights[iz * n1 + ix + 1], cc = heights[(iz + 1) * n1 + ix], d = heights[(iz + 1) * n1 + ix + 1];
      // match PlaneGeometry triangulation (a,c,b) and (c,d,b)
      if (fx + fz <= 1) return a + (b - a) * fx + (cc - a) * fz;
      return d + (cc - d) * (1 - fx) + (b - d) * (1 - fz);
    },
    normalY(x, z) { const e = 1; const hx = this.sample(x + e, z) - this.sample(x - e, z), hz = this.sample(x, z + e) - this.sample(x, z - e); return 2 * e / Math.hypot(hx, 2 * e, hz); },
  };
  world.terrain = terrain;
  return terrain;
}

function makeWater(world, o) {
  const size = o.size || 800;
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const nm = waterNormalTexture().clone(); nm.needsUpdate = true;
  nm.repeat.set(size / 14, size / 14);
  const m = new THREE.MeshStandardMaterial({ color: o.color || '#3b605c', roughness: 0.12, metalness: 0.0, transparent: true, opacity: o.opacity ?? 0.84, depthWrite: true,
    normalMap: GFX.level > 0 ? nm : null, normalScale: new THREE.Vector2(0.16, 0.16), envMapIntensity: 0.8 });
  world.onUpdate((dt) => { nm.offset.x += dt * 0.006; nm.offset.y += dt * 0.004; });
  const w = new THREE.Mesh(geo, m);
  w.position.set(o.x || 0, o.y, o.z || 0);
  w.receiveShadow = true;
  world.add(w);
  world.waterY = o.y;
  world.waterMesh = w;
  return w;
}

// ---------- geometry merge (vertex colored) ----------
function mergeParts(parts) {
  // parts: [{geo, color, m: Matrix4}]
  let total = 0;
  const flat = parts.map((p) => { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo; g.applyMatrix4(p.m || new THREE.Matrix4()); total += g.attributes.position.count; return { g, color: new THREE.Color(p.color) }; });
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3), UV = new Float32Array(total * 2);
  let o = 0;
  for (const { g, color } of flat) {
    g.computeVertexNormals();
    const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
    for (let i = 0; i < pa.count; i++) {
      P[(o + i) * 3] = pa.getX(i); P[(o + i) * 3 + 1] = pa.getY(i); P[(o + i) * 3 + 2] = pa.getZ(i);
      N[(o + i) * 3] = na.getX(i); N[(o + i) * 3 + 1] = na.getY(i); N[(o + i) * 3 + 2] = na.getZ(i);
      C[(o + i) * 3] = color.r; C[(o + i) * 3 + 1] = color.g; C[(o + i) * 3 + 2] = color.b;
      UV[(o + i) * 2] = ua ? ua.getX(i) : 0; UV[(o + i) * 2 + 1] = ua ? ua.getY(i) : 0;
    }
    o += pa.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  return out;
}
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function windMaterial(base, amp = 0.05) {
  const twoSided = base.side === THREE.DoubleSide;
  // the shader text depends on amp, so the program cache must too (three keys programs by the
  // onBeforeCompile source, which is identical for every call — all foliage used to share one sway)
  base.customProgramCacheKey = () => 'wind' + amp.toFixed(4) + (twoSided ? 'd' : '');
  base.onBeforeCompile = (sh) => {
    // cards (grass, ferns, fronds) carry up-facing normals; a double-sided material flips them on
    // the back face, which lit half of every tuft from below and read as black grass
    if (twoSided) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n  normal *= faceDirection;\n#endif');
    sh.uniforms.uTime = WindU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float wph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
      #else
        float wph = 0.0;
      #endif
      float wh = max(position.y, 0.0);
      transformed.x += sin(uTime * 1.6 + wph) * ${amp.toFixed(4)} * wh * wh;
      transformed.z += cos(uTime * 1.25 + wph) * ${(amp*0.7).toFixed(4)} * wh * wh;`);
  };
  return base;
}

// ---------- generated detail textures ----------
const _detTex = {};
function detailTexture(kind = 'grass') {
  if (_detTex[kind]) return _detTex[kind];
  const t = canvasTex(256, 256, (g, w, h) => {
    const base = kind === 'rock' ? 214 : kind === 'mud' ? 206 : 222;
    g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, w, h);
    const r = mulberry32(kind.length * 977);
    for (let i = 0; i < 2600; i++) { const v = base + (r() - 0.5) * 70; g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.55)`; const s = 1 + r() * 3; g.fillRect(r() * w, r() * h, s, s); }
    if (kind === 'grass') for (let i = 0; i < 900; i++) { const x = r() * w, y = r() * h, l = 4 + r() * 9, v = 150 + r() * 110; g.strokeStyle = `rgba(${v | 0},${v | 0},${v | 0},0.55)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - l); g.stroke(); }
    if (kind !== 'grass') for (let i = 0; i < 70; i++) { const v = base - 40 - r() * 60; g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.8)`; g.beginPath(); g.ellipse(r() * w, r() * h, 1.5 + r() * 5, 1 + r() * 3.5, r() * 3, 0, TAU); g.fill(); }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (_detTex[kind] = t);
}
let _waterN = null;
function waterNormalTexture() {
  if (_waterN) return _waterN;
  const N = 128, hgt = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let s = 0;
    for (const [f, a] of [[2, 1], [5, 0.45], [11, 0.2]]) s += a * Math.sin((x / N) * TAU * f + Math.sin((y / N) * TAU * (f - 1)) * 1.3) * Math.cos((y / N) * TAU * f + (x / N) * 2.1);
    hgt[y * N + x] = s;
  }
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = hgt[y * N + ((x + 1) % N)] - hgt[y * N + ((x + N - 1) % N)], dy = hgt[((y + 1) % N) * N + x] - hgt[((y + N - 1) % N) * N + x];
    const nx = -dx * 1.4, ny = -dy * 1.4, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * N + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _waterN = new THREE.CanvasTexture(c);
  _waterN.wrapS = _waterN.wrapT = THREE.RepeatWrapping;
  return _waterN;
}

// ---------- vegetation ----------
let _fernTex = null;
function fernTexture() {
  if (_fernTex) return _fernTex;
  _fernTex = canvasTex(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(w / 2, h); g.quadraticCurveTo(w / 2 + 10, h * 0.5, w / 2 - 4, 6); g.stroke();
    for (let i = 0; i < 18; i++) {
      const t = i / 18, y = h - t * (h - 14), x = w / 2 + 10 * Math.sin(t * 2.2) - 4 * t;
      const len = (1 - t * 0.85) * w * 0.44;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(x, y);
        g.quadraticCurveTo(x + s * len * 0.6, y - 14, x + s * len, y - 22 - t * 6);
        g.quadraticCurveTo(x + s * len * 0.5, y - 4, x, y + 2);
        g.fill();
      }
    }
  });
  return _fernTex;
}
function fernGeometry() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.PlaneGeometry(1, 1.4, 1, 3);
    p.translate(0, 0.7, 0);
    // bend fronds outward
    const pos = p.attributes.position;
    for (let k = 0; k < pos.count; k++) { const y = pos.getY(k); pos.setZ(k, pos.getZ(k) + y * y * 0.18); }
    p.rotateX(-0.25);
    p.rotateY((i / 3) * Math.PI);
    parts.push(p);
  }
  // merge planes
  const g = new THREE.BufferGeometry();
  const P = [], U = [], I = [];
  let off = 0;
  for (const p of parts) {
    const pa = p.attributes.position, ua = p.attributes.uv;
    for (let k = 0; k < pa.count; k++) { P.push(pa.getX(k), pa.getY(k), pa.getZ(k)); U.push(ua.getX(k), ua.getY(k)); }
    for (let k = 0; k < p.index.count; k++) I.push(p.index.getX(k) + off);
    off += pa.count;
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  // normals up-ish for soft lighting
  const n = g.attributes.normal; for (let k = 0; k < n.count; k++) n.setXYZ(k, n.getX(k) * 0.3, 0.9, n.getZ(k) * 0.3);
  return g;
}
// Large scatters are split into square cells: one InstancedMesh over a whole valley has a bounding
// sphere that is always on screen and always inside the shadow camera, so every instance was drawn
// twice a frame. Per-cell meshes let the camera and the shadow frustum skip what they cannot see.
function scatterInstanced(world, geo, material, list, o = {}) {
  const cell = o.chunk ?? 110;
  if (cell && list.length >= 48) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const it of list) { x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x); z0 = Math.min(z0, it.z); z1 = Math.max(z1, it.z); }
    if (Math.max(x1 - x0, z1 - z0) > cell * 1.5) {
      const cells = new Map();
      for (const it of list) { const k = Math.floor(it.x / cell) + ',' + Math.floor(it.z / cell); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(it); }
      const grp = new THREE.Group(); grp.name = 'scatter';
      const k = GFX.level === 2 ? 1.25 : GFX.level === 1 ? 1 : 0.75;
      if (o.far) grp.userData.far = o.far * k;
      // geometry LOD per cell: cells whose nearest edge is beyond lowD metres draw the cheap mesh
      if (o.low) Object.assign(grp.userData, { lowGeo: o.low, lowD: (o.lowD || 60) * k, highGeo: geo });
      for (const sub of cells.values()) grp.add(_instanced(geo, material, sub, o));
      world.add(grp);
      return grp;
    }
  }
  const im = _instanced(geo, material, list, o);
  world.add(im);
  return im;
}
function _instanced(geo, material, list, o) {
  const im = new THREE.InstancedMesh(geo, material, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const col = new THREE.Color();
  list.forEach((it, i) => {
    p.set(it.x, it.y, it.z);
    e.set(it.tilt || 0, it.ry || 0, it.tiltZ || 0);
    q.setFromEuler(e);
    s.set(it.s * (it.sx || 1), it.s * (it.sy || 1), it.s * (it.sx || 1));
    m.compose(p, q, s);
    im.setMatrixAt(i, m);
    if (it.tint) { col.set(it.tint); im.setColorAt(i, col); }
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = !!o.cast; im.receiveShadow = o.receive !== false;
  im.computeBoundingSphere();
  return im;
}
function makeFerns(world, list, o = {}) {
  const m = windMaterial(new THREE.MeshLambertMaterial({ map: fernTexture(), alphaTest: 0.45, side: THREE.DoubleSide, color: o.color || '#ffffff' }));
  return scatterInstanced(world, fernGeometry(), m, list, { cast: false, far: o.far ?? 150 });
}
function coniferGeo() {
  const g = mergeParts([
    { geo: G.cyl(0.18, 0.32, 3, 6), color: '#4a3526', m: M4(0, 1.5, 0) },
    { geo: G.cone(2.2, 3.6, 7), color: '#284834', m: M4(0, 3.8, 0) },
    { geo: G.cone(1.7, 3.0, 7), color: '#2d5139', m: M4(0, 5.6, 0) },
    { geo: G.cone(1.1, 2.6, 7), color: '#345a3f', m: M4(0, 7.3, 0) },
  ]);
  // the undersides of the tiers only see ground bounce; lighter vertex colour keeps them from
  // reading as black holes when the camera is under a tree
  const n = g.attributes.normal, c = g.attributes.color, under = new THREE.Color('#4a6e48');
  for (let i = 0; i < n.count; i++) if (n.getY(i) < -0.6) c.setXYZ(i, under.r, under.g, under.b);
  return g;
}
function cycadGeo() {
  const parts = [{ geo: G.cyl(0.28, 0.42, 1.4, 7), color: '#5a4630', m: M4(0, 0.7, 0) }];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    parts.push({ geo: G.box(0.28, 0.05, 2.1), color: i % 2 ? '#3f6b2f' : '#4b7a36', m: M4(Math.sin(a) * 0.9, 1.65, Math.cos(a) * 0.9, 0.5, a, 0) });
  }
  return mergeParts(parts);
}
function treeFernGeo() {
  const parts = [{ geo: G.cyl(0.16, 0.26, 4.4, 6), color: '#4a3a2a', m: M4(0, 2.2, 0) }];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    parts.push({ geo: G.box(0.5, 0.04, 2.6), color: i % 2 ? '#2f5a2c' : '#3b6a33', m: M4(Math.sin(a) * 1.1, 4.5, Math.cos(a) * 1.1, 0.35, a, 0) });
  }
  return mergeParts(parts);
}
function deadTreeGeo() {
  return mergeParts([
    { geo: G.cyl(0.2, 0.38, 7, 6), color: '#4b463c', m: M4(0, 3.5, 0, 0.05, 0, 0.04) },
    { geo: G.cyl(0.07, 0.14, 3, 5), color: '#4b463c', m: M4(0.8, 5, 0, 0, 0, -0.8) },
    { geo: G.cyl(0.06, 0.12, 2.4, 5), color: '#4b463c', m: M4(-0.6, 4.2, 0.3, 0.3, 0, 0.9) },
  ]);
}
function rockGeo(seedv, detail = 1) {
  const g = new THREE.DodecahedronGeometry(1, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 0.78 + 0.35 * hash2(Math.round(x * 50) + seedv, Math.round(z * 50 + y * 30));
    p.setXYZ(i, x * n, y * n, z * n);
  }
  g.computeVertexNormals();
  return g;
}
const vegMat = (amp = 0.01) => windMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), amp);
const leafMat = (amp = 0.008) => windMaterial(new THREE.MeshLambertMaterial({ vertexColors: true }), amp);

// broadleaf tree / bush: jittered icosahedron canopies on a trunk, smooth-shaded
function _blob(r, detail, rnd01, jit = 0.14) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position, n = g.attributes.normal;
  // radial normals: smooth at any detail (detail 0 would otherwise come out faceted); vertices
  // shared between faces get the same jitter so the low-detail blob stays closed
  const jitAt = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), key = Math.round(x * 1e3) + ',' + Math.round(y * 1e3) + ',' + Math.round(z * 1e3);
    if (!jitAt.has(key)) jitAt.set(key, 1 + (rnd01() - 0.5) * 2 * jit);
    const k = jitAt.get(key), l = Math.hypot(x, y, z) || 1;
    p.setXYZ(i, x * k, y * k, z * k); n.setXYZ(i, x / l, y / l, z / l);
  }
  return g;
}
function broadleafGeo(seedv = 1, detail = 1) {
  const r = mulberry32(seedv * 131 + 7);
  const parts = [{ geo: G.cyl(0.17, 0.32, 4.4, 8), color: '#4d3b2a', m: M4(0, 2.2, 0, 0, 0, 0.03) }];
  parts.push({ geo: G.cyl(0.05, 0.1, 2.0, 6), color: '#4d3b2a', m: M4(0.55, 3.7, 0.1, 0, 0, -0.75) });
  parts.push({ geo: G.cyl(0.05, 0.09, 1.7, 6), color: '#4d3b2a', m: M4(-0.45, 3.9, -0.2, 0.3, 0, 0.8) });
  const greens = ['#557f3a', '#5f8a40', '#4d7536', '#6a9448', '#5a8440'];
  for (let i = 0; i < 7; i++) {
    const a = r() * TAU, rr = i === 0 ? 0 : 0.8 + r() * 1.3, y = i === 0 ? 5.6 : 4.4 + r() * 1.9;
    parts.push({ geo: _blob(1.15 + r() * 0.6, detail, mulberry32((r() * 4294967296) >>> 0)), color: greens[(i + seedv) % greens.length], m: M4(Math.cos(a) * rr, y, Math.sin(a) * rr, 0, r() * TAU, 0, 1.25, 0.82, 1.25) });
  }
  return mergeColored(parts);
}
function bushGeo(seedv = 1, detail = 1) {
  const r = mulberry32(seedv * 71 + 3);
  const parts = [];
  const greens = ['#4f7535', '#5a803c', '#648a44', '#527a38'];
  for (let i = 0; i < 4; i++) { const a = r() * TAU, rr = r() * 0.6; parts.push({ geo: _blob(0.55 + r() * 0.35, detail, mulberry32((r() * 4294967296) >>> 0), 0.2), color: greens[(i + seedv) % 4], m: M4(Math.cos(a) * rr, 0.45 + r() * 0.3, Math.sin(a) * rr, 0, 0, 0, 1.2, 0.8, 1.2) }); }
  return mergeColored(parts);
}
function palmTrunkGeo() {
  const parts = [];
  let x = 0, y = 0;
  for (let i = 0; i < 7; i++) { const lean = 0.05 + i * 0.035; parts.push({ geo: G.cyl(0.19 - i * 0.012, 0.22 - i * 0.012, 1.0, 8), color: i % 2 ? '#7d6c4e' : '#6e5e43', m: M4(x, y + 0.5, 0, 0, 0, -lean) }); x += Math.sin(lean) * 1.0; y += Math.cos(lean) * 0.98; }
  parts.push({ geo: G.sphere(0.32, 8, 6), color: '#4a5a2a', m: M4(x, y + 0.05, 0) });
  const g = mergeColored(parts);
  g.userData = { top: [x, y] };
  return g;
}
function palmFrondGeo(top) {
  const P = [], U = [], I = [];
  let off = 0;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + (i % 2) * 0.2;
    const pl = new THREE.PlaneGeometry(1.1, 3.4, 1, 5);
    pl.translate(0, 1.7, 0);
    const pa = pl.attributes.position;
    for (let k = 0; k < pa.count; k++) { const yy = pa.getY(k); pa.setZ(k, pa.getZ(k) - yy * yy * 0.12); }
    pl.rotateX(-1.05 - (i % 3) * 0.12);
    pl.rotateY(a);
    pl.translate(top[0], top[1], 0);
    const ua = pl.attributes.uv;
    for (let k = 0; k < pa.count; k++) { P.push(pa.getX(k), pa.getY(k), pa.getZ(k)); U.push(ua.getX(k), ua.getY(k)); }
    for (let k = 0; k < pl.index.count; k++) I.push(pl.index.getX(k) + off);
    off += pa.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I); g.computeVertexNormals();
  return g;
}
function makePalms(world, list) {
  if (!list.length) return;
  const trunk = palmTrunkGeo();
  scatterInstanced(world, trunk, leafMat(0.004), list, { cast: true });
  const fm = windMaterial(new THREE.MeshLambertMaterial({ map: fernTexture(), alphaTest: 0.45, side: THREE.DoubleSide, color: '#7fa650' }), 0.012);
  scatterInstanced(world, palmFrondGeo(trunk.userData.top), fm, list, { cast: true });
}

// grass that lives around the player: a fixed pool of tufts is re-seeded ahead as you walk
let _grassTex = null;
function grassTexture() {
  if (_grassTex) return _grassTex;
  _grassTex = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(99);
    for (let i = 0; i < 26; i++) {
      const x = 8 + r() * (w - 16), bend = (r() - 0.5) * 22, top = 10 + r() * 55, wd = 1.2 + r() * 1.6;
      const v = 190 + r() * 65;
      g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
      g.beginPath(); g.moveTo(x - wd, h); g.quadraticCurveTo(x + bend * 0.4, (h + top) / 2, x + bend, top); g.quadraticCurveTo(x + bend * 0.4 + 1, (h + top) / 2, x + wd, h); g.fill();
    }
  });
  return _grassTex;
}
function grassGeometry() {
  const P = [], U = [], I = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI, c = Math.cos(a), s = Math.sin(a), b = i * 4;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const x = (u - 0.5) * 0.7; P.push(x * c, v * 0.42, x * s); U.push(u, v); }
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  const n = new Float32Array(P.length); for (let k = 0; k < n.length; k += 3) { n[k] = 0; n[k + 1] = 1; n[k + 2] = 0; }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}
function makeGrassField(world, o) {
  const count = o.count | 0;
  if (count <= 0) return null;
  const m = windMaterial(new THREE.MeshLambertMaterial({ map: grassTexture(), alphaTest: 0.5, side: THREE.DoubleSide, color: o.color || '#ffffff' }), 0.5);
  const im = new THREE.InstancedMesh(grassGeometry(), m, count);
  im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true;
  const pos = new Float32Array(count * 2);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const R = o.radius || 42, zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const place = (i, cx, cz, fx, fz) => {
    for (let tries = 0; tries < 6; tries++) {
      let a = Math.random() * TAU, r = Math.sqrt(Math.random()) * R;
      if (fx !== undefined) { a = Math.atan2(fz, fx) + (Math.random() - 0.5) * Math.PI * 1.1; r = R * (0.72 + Math.random() * 0.28); }
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!o.accept(x, z)) continue;
      pos[i * 2] = x; pos[i * 2 + 1] = z;
      const sc = (0.55 + Math.random() * 0.6) * (o.scale || 1);
      p.set(x, world.groundH(x, z) - 0.04, z); e.set(0, Math.random() * TAU, 0); q.setFromEuler(e); s.set(sc, sc * (0.75 + Math.random() * 0.6), sc);
      mtx.compose(p, q, s); im.setMatrixAt(i, mtx);
      col.set(o.tints[(Math.random() * o.tints.length) | 0]); im.setColorAt(i, col);
      return;
    }
    pos[i * 2] = pos[i * 2 + 1] = 1e7; im.setMatrixAt(i, zero);
  };
  for (let i = 0; i < count; i++) place(i, o.cx ?? 0, o.cz ?? 0);
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  let cursor = 0;
  world.onUpdate(() => {
    const P = Game.player;
    if (!P || !P.model.parent) return;
    const px = P.pos.x, pz = P.pos.z, fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    let changed = false;
    const n = Math.min(count, 500);
    for (let k = 0; k < n; k++) {
      const i = cursor; cursor = (cursor + 1) % count;
      const dx = pos[i * 2] - px, dz = pos[i * 2 + 1] - pz;
      if (dx * dx + dz * dz > R * R * 1.08) { if (dx * dx + dz * dz > R * R * 9) place(i, px, pz); else place(i, px, pz, fx, fz); changed = true; }
    }
    if (changed) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  });
  world.add(im);
  return im;
}

// ---------- particles ----------
function makeMotes(world, o = {}) {
  const count = o.count || (QUALITY ? 500 : 250), R = o.range || 40;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { pos[i * 3] = rnd(-R, R); pos[i * 3 + 1] = rnd(0, 12); pos[i * 3 + 2] = rnd(-R, R); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: o.color || '#fff3c4', size: o.size || 0.09, transparent: true, opacity: o.opacity ?? 0.75, depthWrite: false });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  world.add(pts);
  world.onUpdate((dt) => {
    const c = camera.position, wv = world.wind, sp = o.speed ?? 1.2;
    for (let i = 0; i < count; i++) {
      let x = pos[i * 3] + wv.x * sp * dt + Math.sin(Game.time * 0.7 + i) * 0.05 * dt * 10;
      let y = pos[i * 3 + 1] + Math.sin(Game.time + i * 1.3) * 0.2 * dt + (o.fall || 0) * dt;
      let z = pos[i * 3 + 2] + wv.y * sp * dt;
      if (x - c.x > R) x -= 2 * R; if (x - c.x < -R) x += 2 * R;
      if (z - c.z > R) z -= 2 * R; if (z - c.z < -R) z += 2 * R;
      if (y - c.y > 14) y -= 22; if (y - c.y < -8) y += 22;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    g.attributes.position.needsUpdate = true;
  });
  return pts;
}
function makeRain(world, o = {}) {
  const count = o.count || (QUALITY ? 1800 : 800), R = 30;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 6);
  const init = (i, c) => {
    const x = c.x + rnd(-R, R), y = c.y + rnd(-5, 25), z = c.z + rnd(-R, R);
    pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z; pos[i * 6 + 3] = x - 0.15; pos[i * 6 + 4] = y - 0.9; pos[i * 6 + 5] = z;
  };
  for (let i = 0; i < count; i++) init(i, camera.position);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineBasicMaterial({ color: o.color || '#9fb2c2', transparent: true, opacity: o.opacity ?? 0.45, depthWrite: false });
  const lines = new THREE.LineSegments(g, m);
  lines.frustumCulled = false;
  world.add(lines);
  world.rain = lines;
  world.onUpdate((dt) => {
    if (!lines.visible) return;
    const c = camera.position, v = 28 * dt;
    for (let i = 0; i < count; i++) {
      pos[i * 6 + 1] -= v; pos[i * 6 + 4] -= v; pos[i * 6] -= v * 0.16; pos[i * 6 + 3] -= v * 0.16;
      if (pos[i * 6 + 1] < c.y - 6 || Math.abs(pos[i * 6] - c.x) > R || Math.abs(pos[i * 6 + 2] - c.z) > R) init(i, c);
    }
    g.attributes.position.needsUpdate = true;
  });
  return lines;
}
function makeFlies(world, x, y, z, n = 14) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#111', size: 0.05, depthWrite: false }));
  pts.frustumCulled = false;
  world.add(pts);
  world.onUpdate(() => {
    for (let i = 0; i < n; i++) {
      const t = Game.time * (2 + (i % 5) * 0.6) + i * 2.1;
      pos[i * 3] = x + Math.sin(t) * 0.5; pos[i * 3 + 1] = y + 0.35 + Math.sin(t * 1.7) * 0.2; pos[i * 3 + 2] = z + Math.cos(t * 1.3) * 0.5;
    }
    g.attributes.position.needsUpdate = true;
  });
  return pts;
}

// ---------- decals ----------
let _printTex = null;
function printTexture() {
  if (_printTex) return _printTex;
  _printTex = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = 'rgba(30,22,14,0.85)';
    g.beginPath(); g.ellipse(32, 40, 14, 16, 0, 0, TAU); g.fill();
    [[-14, 16, -0.5], [0, 10, 0], [14, 16, 0.5]].forEach(([dx, dy, r]) => { g.save(); g.translate(32 + dx, dy + 6); g.rotate(r); g.beginPath(); g.ellipse(0, 0, 5, 9, 0, 0, TAU); g.fill(); g.restore(); });
  });
  return _printTex;
}
function decal(world, x, z, o = {}) {
  const s = o.size || 0.9;
  const geo = new THREE.PlaneGeometry(s, s * (o.aspect || 1));
  geo.rotateX(-Math.PI / 2);
  const m = o.material || new THREE.MeshLambertMaterial({ map: o.map || printTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const d = new THREE.Mesh(geo, m);
  d.position.set(x, world.groundH(x, z) + (o.lift ?? 0.04), z);
  d.rotation.y = o.ry || 0;
  d.receiveShadow = true;
  world.add(d);
  return d;
}
const BLOOD_MAT = () => new THREE.MeshStandardMaterial({ color: '#6e0b0b', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
let _bloodTex = null;
function bloodTexture() {
  if (_bloodTex) return _bloodTex;
  _bloodTex = canvasTex(64, 64, (g) => {
    g.fillStyle = '#fff';
    for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(32 + rnd(-14, 14), 32 + rnd(-14, 14), rnd(3, 11), 0, TAU); g.fill(); }
  });
  return _bloodTex;
}
function bloodDecal(world, x, z, s = 0.8) {
  const m = BLOOD_MAT(); m.alphaMap = bloodTexture(); m.alphaTest = 0.2;
  return decal(world, x, z, { size: s, material: m, ry: rnd(0, TAU), lift: 0.06 });
}

// ---------- ripples & wakes ----------
class Ripples {
  constructor(world, n = 24) {
    this.pool = [];
    this.world = world;
    const geo = new THREE.RingGeometry(0.9, 1, 32); geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const m = new THREE.MeshBasicMaterial({ color: '#dbe8e4', transparent: true, opacity: 0, depthWrite: false });
      const r = new THREE.Mesh(geo, m); r.visible = false; r.renderOrder = 2;
      world.add(r);
      this.pool.push({ mesh: r, t: 0, dur: 1, max: 1, alive: false, op: 0.6 });
    }
    world.onUpdate((dt) => this.update(dt));
  }
  spawn(x, z, max = 1.5, dur = 1.6, op = 0.55) {
    const p = this.pool.find((q) => !q.alive) || this.pool[0];
    p.alive = true; p.t = 0; p.dur = dur; p.max = max; p.op = op;
    p.mesh.visible = true; p.mesh.position.set(x, this.world.waterY + 0.03, z);
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.t += dt;
      const k = p.t / p.dur;
      if (k >= 1) { p.alive = false; p.mesh.visible = false; continue; }
      const s = 0.2 + p.max * k;
      p.mesh.scale.set(s, 1, s);
      p.mesh.material.opacity = p.op * (1 - k);
    }
  }
}
function makeWake(world) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: '#dfeae6', transparent: true, opacity: 0.5, depthWrite: false });
  const a = new THREE.Mesh(G.box(0.12, 0.02, 5), m); a.position.set(-1.2, 0, -2.2); a.rotation.y = -0.45;
  const b = new THREE.Mesh(G.box(0.12, 0.02, 5), m); b.position.set(1.2, 0, -2.2); b.rotation.y = 0.45;
  g.add(a, b);
  g.userData.mat = m;
  world.add(g);
  return g;
}

// ---------- the Veil (cloud wall on the horizon) ----------
function makeVeil(world, o = {}) {
  const tex = canvasTex(1024, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(70,76,84,0)');
    grd.addColorStop(0.3, 'rgba(66,72,80,0.55)');
    grd.addColorStop(0.7, 'rgba(52,57,64,0.9)');
    grd.addColorStop(1, 'rgba(40,44,50,0.96)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = rnd(-60, w + 60), y = rnd(h * 0.08, h * 0.75), r = rnd(18, 70);
      const v = Math.floor(rnd(70, 128));
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${v},${v + 4},${v + 12},${rnd(0.18, 0.4)})`);
      rg.addColorStop(1, `rgba(${v},${v + 4},${v + 12},0)`);
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1);
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false, color: o.color || '#ffffff', opacity: o.opacity ?? 1 });
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(o.r || 900, o.r || 900, o.h || 320, 48, 1, true), m);
  cyl.position.set(o.x || 0, (o.h || 320) / 2 - 40, o.z || 0);
  cyl.renderOrder = -5;
  world.add(cyl);
  world.onUpdate((dt) => { tex.offset.x += dt * 0.002; });
  return cyl;
}

// ---------- props ----------
function makeTent(world, x, z, ry = 0, color = '#5d6647') {
  const g = new THREE.Group();
  const shape = new THREE.Shape(); shape.moveTo(-1.6, 0); shape.lineTo(0, 2.1); shape.lineTo(1.6, 0); shape.lineTo(-1.6, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 3.4, bevelEnabled: false }); geo.translate(0, 0, -1.7);
  mesh(geo, mat(color), { parent: g, receive: true });
  g.position.set(x, world.groundH(x, z), z); g.rotation.y = ry;
  world.add(g);
  world.circles.push({ x, z, r: 1.9 });
  return g;
}
function makeCrate(world, x, z, s = 1, color = '#4f5a3c', ry = 0) {
  const c = mesh(G.box(1.2 * s, 0.8 * s, 0.9 * s), mat(color), { pos: [x, world.groundH(x, z) + 0.4 * s, z], rot: [0, ry, 0], receive: true });
  world.add(c);
  world.circles.push({ x, z, r: 0.75 * s });
  return c;
}
// makeHelicopter: see 28-heli.js
