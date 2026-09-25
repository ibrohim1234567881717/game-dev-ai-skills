// ============================================================
// 00-core.js — math, renderer, materials, save, game state
// ============================================================
const IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
// graphics level: 0 low, 1 medium, 2 high. Stored per browser; density-based choices (vegetation,
// grass) apply when a chapter is built, the rest (post-processing, shadows, resolution) at once.
const GFX = {
  level: (() => { try { const v = localStorage.getItem('umbra.gfx'); if (v !== null && !isNaN(+v)) return Math.max(0, Math.min(2, +v)); } catch (e) { /* storage blocked */ } return IS_TOUCH ? 0 : 2; })(),
  names: ['Низкая', 'Средняя', 'Высокая'],
};
const QUALITY = GFX.level > 0 ? 1 : 0; // density tier for world building
if (IS_TOUCH) document.body.classList.add('touch');

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapAngle = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const dampAngle = (a, b, k, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-k * dt));
const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const $ = (id) => document.getElementById(id);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(1983);
const seed = (s) => { rng = mulberry32(s); };
const rnd = (a = 0, b = 1) => a + (b - a) * rng();
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

function hash2(x, z) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
function fbm(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 17.3, z * f - i * 9.1); f *= 2.03; a *= 0.5; }
  return s;
}

// ---------- renderer ----------
const canvas = $('game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY > 0, powerPreference: 'high-performance' });
} catch (e) {
  $('boot').textContent = 'Этот браузер не поддерживает WebGL. Откройте игру в Chrome, Safari или Firefox.';
  throw e;
}
const pixelRatioFor = (lvl) => Math.min(window.devicePixelRatio || 1, [1, 1.3, 1.75][lvl]);
renderer.setPixelRatio(pixelRatioFor(GFX.level));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.info.autoReset = false; // one frame = scene + shadow + post passes; reset in the main loop
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1600);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  try { Post.resize(); } catch (e) { /* Post is declared later in the bundle; the first call happens before it exists */ }
}
window.addEventListener('resize', resize);
resize();

// ---------- materials ----------
const _matCache = new Map();
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (_matCache.has(key)) return _matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.88, metalness: o.metal ?? 0, flatShading: o.flat ?? true, envMapIntensity: o.env ?? 0.55, ...(o.extra || {}) });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  if (o.side) m.side = o.side;
  if (o.transparent) { m.transparent = true; m.opacity = o.opacity ?? 0.8; m.depthWrite = o.depthWrite ?? false; }
  _matCache.set(key, m);
  return m;
}
function uniqueMat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, flatShading: o.flat ?? true });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  if (o.transparent) { m.transparent = true; m.opacity = o.opacity ?? 0.8; m.depthWrite = false; }
  if (o.side) m.side = o.side;
  return m;
}
function mesh(geo, material, p = {}) {
  const m = new THREE.Mesh(geo, material);
  if (p.pos) m.position.set(p.pos[0], p.pos[1], p.pos[2]);
  if (p.rot) m.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
  if (p.scale !== undefined) { if (Array.isArray(p.scale)) m.scale.set(p.scale[0], p.scale[1], p.scale[2]); else m.scale.setScalar(p.scale); }
  m.castShadow = p.cast ?? true;
  m.receiveShadow = p.receive ?? false;
  if (p.parent) p.parent.add(m);
  return m;
}
const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  sphere: (r, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs),
  cyl: (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s),
  cone: (r, h, s = 8) => new THREE.ConeGeometry(r, h, s),
  capsule: (r, l, cs = 4, rs = 8) => new THREE.CapsuleGeometry(r, l, cs, rs),
};

function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => { if (!_isCached(m)) { if (m.map) m.map.dispose(); m.dispose(); } });
    }
  });
}
function _isCached(m) { for (const v of _matCache.values()) if (v === m) return true; return false; }

// canvas textures
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat, opts.repeat); }
  t.anisotropy = 4;
  return t;
}

// ---------- save ----------
const SAVE_KEY = 'umbra.d05.save.v1';
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && typeof s === 'object' ? s : null; } catch (e) { return null; }
}
function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      unlocked: Game.unlocked, dna: Game.state.dna, flags: Game.state.flags,
      journal: Object.fromEntries(Object.entries(Game.state.journal).map(([k, v]) => [k, [...v]])),
      current: Game.currentId,
    }));
  } catch (e) { /* storage blocked — progress lives only in this tab */ }
}

// ---------- game state ----------
const CHAPTERS = {};
const CHAPTER_ORDER = ['prologue', 'valley', 'k4', 'river', 'peaks', 'truth', 'queen', 'dawn'];
const DNA_KEYS = ['tri', 'rap', 'spi', 'pte', 'rex'];
const Game = {
  time: 0,
  paused: false,
  inMenu: true,
  chapter: null,
  currentId: null,
  unlocked: ['prologue'],
  state: {
    dna: { tri: false, rap: false, spi: false, pte: false, rex: false, eva: false },
    journal: {},
    flags: {},
    photos: [],
  },
  muted: false,
};
function resetState() {
  Game.state.dna = { tri: false, rap: false, spi: false, pte: false, rex: false, eva: false };
  Game.state.journal = {};
  Game.state.flags = {};
  Game.state.photos = [];
}
function dnaCount() { return DNA_KEYS.filter((k) => Game.state.dna[k]).length; }
