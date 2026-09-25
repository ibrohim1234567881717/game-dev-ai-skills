// ============================================================
// 30-player.js — player, camera rig, cinematics, interaction, photo
// ============================================================
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

class Player {
  constructor() {
    this.model = makeCharacter('ethan');
    this.model.userData.isPlayer = true;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.crouch = false;
    this.speed = 0;
    this.noise = 0;
    this.health = 3;
    this.frozen = false;
    this.knock = new THREE.Vector3();
    this.radius = 0.4;
    this.moving = false;
    this.stillTime = 0;
    this.inWater = 0;
    this.world = null;
    this.lastSafe = new THREE.Vector3();
  }
  attach(world) { this.world = world; world.add(this.model); this.setCaseLights(Game.state.dna); }
  setCaseLights(dna) {
    const L = this.model.userData.caseLights;
    if (!L) return;
    const keys = ['tri', 'rap', 'spi', 'pte', 'rex', 'eva'];
    keys.forEach((k, i) => {
      const m = L[i].material;
      if (k === 'eva') { m.emissive.set(dna.eva ? '#b98cff' : '#222'); m.emissiveIntensity = dna.eva ? 2.2 : 0.1; return; }
      m.emissive.set(dna[k] ? '#43ff8a' : '#e3a33b'); m.emissiveIntensity = dna[k] ? 2.4 : 0.35;
    });
  }
  place(x, z, yaw = 0) {
    this.pos.set(x, this.world.groundH(x, z), z);
    this.yaw = yaw; this.model.rotation.y = yaw;
    this.model.position.copy(this.pos);
    this.lastSafe.copy(this.pos);
    this.knock.set(0, 0, 0);
  }
  hurt(n = 1, from) {
    this.health = Math.max(0, this.health - n);
    HUD.health(this.health);
    Cam.shake = 0.6;
    HUD.flash(0.35, 0.4);
    if (from) { _v1.subVectors(this.pos, from).setY(0).normalize().multiplyScalar(9); this.knock.copy(_v1); }
    return this.health;
  }
  heal() { this.health = 3; HUD.health(3); }
  update(dt) {
    const w = this.world;
    if (!this.frozen && Input.enabled && Input.pressed('crouch')) { this.crouch = !this.crouch; $('tbCrouch').classList.toggle('on', this.crouch); }
    const mv = this.frozen || !Input.enabled || Cam.mode !== 'third' ? { x: 0, y: 0 } : Input.computeMove();
    const mag = Math.hypot(mv.x, mv.y);
    const run = Input.running() && !this.crouch && mag > 0.5;
    const ground = w.groundH(this.pos.x, this.pos.z);
    const depth = w.waterY - ground;
    this.inWater = depth > 0 ? depth : 0;
    let target = (this.crouch ? 1.8 : run ? 6.6 : 3.5) * Math.min(1, mag * 1.15);
    if (this.inWater > 0.15) target *= 0.62;
    target *= w.speedMul ?? 1;
    this.speed = damp(this.speed, target, 10, dt);
    const cy = Cam.yaw;
    const fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
    let dx = fx * mv.y + rx * mv.x, dz = fz * mv.y + rz * mv.x;
    const dl = Math.hypot(dx, dz);
    if (dl > 0.001) { dx /= dl; dz /= dl; this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 12, dt); }
    const ox = this.pos.x, oz = this.pos.z;
    let nx = ox + (dl > 0.001 ? dx * this.speed * dt : 0) + this.knock.x * dt;
    let nz = oz + (dl > 0.001 ? dz * this.speed * dt : 0) + this.knock.z * dt;
    this.knock.multiplyScalar(Math.exp(-5 * dt));
    if (w.push) { const p = w.push(nx, nz, dt); nx += p.x; nz += p.z; }
    // collisions
    const r = this.radius;
    for (const c of w.circles) {
      const ddx = nx - c.x, ddz = nz - c.z, d = Math.hypot(ddx, ddz), min = c.r + r;
      if (d < min && d > 0.0001) { nx = c.x + (ddx / d) * min; nz = c.z + (ddz / d) * min; }
    }
    for (const b of w.boxes) {
      if (b.off) continue;
      if (nx > b.x0 - r && nx < b.x1 + r && nz > b.z0 - r && nz < b.z1 + r) {
        const pl = nx - (b.x0 - r), pr = b.x1 + r - nx, pb = nz - (b.z0 - r), pf = b.z1 + r - nz;
        const m = Math.min(pl, pr, pb, pf);
        if (m === pl) nx = b.x0 - r; else if (m === pr) nx = b.x1 + r; else if (m === pb) nz = b.z0 - r; else nz = b.z1 + r;
      }
    }
    if (w.bounds) {
      const bd = dist2d(nx, nz, w.bounds.x, w.bounds.z);
      if (bd > w.bounds.r) { nx = w.bounds.x + (nx - w.bounds.x) * w.bounds.r / bd; nz = w.bounds.z + (nz - w.bounds.z) * w.bounds.r / bd; }
    }
    const cg = w.groundH(ox, oz);
    const canStand = (x, z) => {
      const g = w.groundH(x, z);
      if (w.blocked && w.blocked(x, z, g)) return false;
      if (!w.allowDeep && w.waterY - g > (w.maxDepth ?? 1.1)) return false;
      if (w.maxSlope) { const md = Math.hypot(x - ox, z - oz); const dh = g - cg; if (md > 0.0005 && Math.abs(dh) > 0.3 && Math.abs(dh) / md > w.maxSlope) return false; }
      return true;
    };
    let blocked = false;
    if (canStand(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
    else if (canStand(nx, oz)) { this.pos.x = nx; }
    else if (canStand(ox, nz)) { this.pos.z = nz; }
    else blocked = true;
    const ng = w.groundH(this.pos.x, this.pos.z);
    const deep = w.waterY - ng > (w.maxDepth ?? 1.1);
    const gy = w.groundH(this.pos.x, this.pos.z);
    this.pos.y = w.snapY ? gy : damp(this.pos.y, gy, 20, dt);
    if (!blocked && !deep) this.lastSafe.copy(this.pos);
    this.moving = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-4) > 0.3;
    this.stillTime = this.moving ? 0 : this.stillTime + dt;
    // noise
    let n = 0;
    if (this.moving) n = this.crouch ? 1.5 : this.speed > 5 ? 15 : 6;
    if (this.moving && this.inWater > 0.1) n *= 1.6;
    n *= w.noiseMul ?? 1;
    this.noise = n;
    HUD.noise(n);
    // model
    this.model.position.copy(this.pos);
    if (this.inWater > 0) this.model.position.y = Math.max(this.pos.y, w.waterY - 0.9);
    this.model.rotation.y = this.yaw;
    this.model.visible = Cam.mode === 'third' || Cam.mode === 'cine';
    const sp = HUD.speaking;
    this.model.userData.anim(dt, this.speed, { crouch: this.crouch, talk: !!(sp && sp.key === 'ethan' && !sp.radio) });
  }
  eye() { return _v3.set(this.pos.x, this.pos.y + (this.crouch ? 1.05 : 1.62), this.pos.z); }
}

// ---------- camera rig ----------
const Cam = {
  mode: 'third', yaw: 0, pitch: 0.22, dist: 5.2, shake: 0, fov: 62,
  cinePos: new THREE.Vector3(), cineLook: new THREE.Vector3(),
  curPos: new THREE.Vector3(), curLook: new THREE.Vector3(),
  pull: null, // {x,z,strength,time} — soft look-at suggestion
  setYaw(y) { this.yaw = y; },
  lookFromInput(sens = 1) {
    if (!Input.enabled) return;
    this.yaw -= Input.look.x * 0.0026 * sens;
    this.pitch = clamp(this.pitch + Input.look.y * 0.0022 * sens, this.mode === 'third' ? -0.5 : -1.2, this.mode === 'third' ? 1.15 : 1.2);
  },
  update(dt) {
    const p = Game.player, w = Game.world;
    let pos = _v1, look = _v2;
    let targetFov = 62;
    if (this.mode === 'cine') {
      pos.copy(this.cinePos); look.copy(this.cineLook);
      this.curPos.lerp(pos, 1 - Math.exp(-6 * dt)); this.curLook.lerp(look, 1 - Math.exp(-6 * dt));
      if (Cine.snap || Cine.rigid) { this.curPos.copy(pos); this.curLook.copy(look); Cine.snap = false; }
      camera.position.copy(this.curPos);
      camera.lookAt(this.curLook);
      targetFov = Cine.fov || 55;
    } else if (!p) {
      return;
    } else if (this.mode === 'photo' || this.mode === 'aim') {
      this.lookFromInput(0.55);
      const e = p.eye();
      camera.position.copy(e);
      const cp = Math.cos(this.pitch);
      look.set(e.x - Math.sin(this.yaw) * cp, e.y - Math.sin(this.pitch), e.z - Math.cos(this.yaw) * cp);
      camera.lookAt(look);
      targetFov = this.mode === 'aim' ? 32 : 36;
      this.curPos.copy(camera.position); this.curLook.copy(look);
    } else {
      this.lookFromInput(1);
      if (this.pull && Input.look.x === 0) {
        const pl = this.pull;
        const want = Math.atan2(-(pl.x - p.pos.x), -(pl.z - p.pos.z));
        this.yaw = dampAngle(this.yaw, want, pl.strength, dt);
        pl.time -= dt; if (pl.time <= 0) this.pull = null;
      }
      const ty = Math.max(p.pos.y, p.model.position.y) + (p.crouch ? 1.15 : 1.55);
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const tx = p.pos.x + rx * 0.42, tz = p.pos.z + rz * 0.42;
      const cp = Math.cos(this.pitch);
      let d = this.dist * (p.crouch ? 0.85 : 1);
      // collision against boxes (indoor) — march from target outwards
      const ox = Math.sin(this.yaw) * cp, oy = Math.sin(this.pitch), oz = Math.cos(this.yaw) * cp;
      if (w.boxes.length || w.ceiling) {
        for (let s = 1; s <= 12; s++) {
          const k = (s / 12) * d;
          const x = tx + ox * k, y = ty + oy * k, z = tz + oz * k;
          let hit = w.ceiling && y > w.ceiling - 0.3;
          if (!hit) for (const b of w.boxes) { if (!b.off && !b.low && x > b.x0 - 0.2 && x < b.x1 + 0.2 && z > b.z0 - 0.2 && z < b.z1 + 0.2) { hit = true; break; } }
          if (hit) { d = Math.max(0.8, ((s - 1) / 12) * d); break; }
        }
      }
      pos.set(tx + ox * d, ty + oy * d, tz + oz * d);
      const gh = w.groundH(pos.x, pos.z) + 0.4;
      if (pos.y < gh) pos.y = gh;
      if (w.waterY > -1e8 && pos.y < w.waterY + 0.3) pos.y = w.waterY + 0.3;
      look.set(tx, ty, tz);
      this.curPos.lerp(pos, 1 - Math.exp(-14 * dt));
      this.curLook.copy(look);
      camera.position.copy(this.curPos);
      camera.lookAt(look);
    }
    if (this.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      camera.position.y += (Math.random() - 0.5) * this.shake * 0.5;
      camera.rotation.z += (Math.random() - 0.5) * this.shake * 0.04;
      this.shake *= Math.exp(-4 * dt);
    }
    const fovNow = damp(camera.fov, targetFov, 6, dt);
    if (Math.abs(fovNow - camera.fov) > 0.01) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
  },
  heading() { return -this.yaw; },
};

// ---------- cinematics ----------
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const Cine = {
  active: false, shots: [], i: 0, t: 0, resolve: null, fov: 55, snap: false, prevMode: 'third', speed: 1,
  play(shots, o = {}) {
    return new Promise((resolve) => {
      this.shots = shots; this.i = 0; this.t = 0; this.resolve = resolve; this.active = true; this.speed = 1;
      this.prevMode = Cam.mode === 'cine' ? this.prevMode : Cam.mode;
      Cam.mode = 'cine';
      this.snap = o.snap !== false;
      this.skippable = o.skippable !== false;
      if (o.letterbox !== false) HUD.letterbox(true);
      Input.enabled = false;
      this._start();
    });
  },
  _start() { const s = this.shots[this.i]; if (s && s.onStart) s.onStart(); if (s && s.fov) this.fov = s.fov; if (s && s.cut) this.snap = true; this.rigid = !!(s && s.rigid); },
  _eval(v, k) { return typeof v === 'function' ? v(k) : v; },
  update(dt) {
    if (!this.active) return;
    if (this.skippable && (Input.pressed('confirm') || Input.pressed('interact') || Input.pressed('shoot'))) this.speed = 6;
    const s = this.shots[this.i];
    this.t += dt * this.speed;
    const k = s.dur ? clamp(this.t / s.dur, 0, 1) : 1;
    const e = s.linear ? k : ease(k);
    const from = this._eval(s.from, e), to = this._eval(s.to || s.from, e);
    Cam.cinePos.lerpVectors(from, to, e);
    const lf = this._eval(s.lookFrom || s.look, e), lt = this._eval(s.lookTo || s.look, e);
    Cam.cineLook.lerpVectors(lf, lt, e);
    if (s.onUpdate) s.onUpdate(k, dt);
    if (k >= 1) {
      if (s.onEnd) s.onEnd();
      this.i++; this.t = 0;
      if (this.i >= this.shots.length) this.stop(); else this._start();
    }
  },
  stop() {
    this.active = false; this.rigid = false;
    Cam.mode = this.prevMode === 'cine' ? 'third' : this.prevMode;
    HUD.letterbox(false);
    Input.enabled = true;
    Input.edges.clear();
    const r = this.resolve; this.resolve = null;
    if (r) r();
  },
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- interaction ----------
const Interact = {
  hold: 0, cur: null,
  update(dt, world) {
    if (Cam.mode !== 'third' || !Input.enabled || DNA.busy) { this.hold = 0; return; }
    const p = Game.player;
    let best = null, bd = 1e9;
    for (const it of world.interactables) {
      if (!it.enabled()) continue;
      const d = dist2d(p.pos.x, p.pos.z, it.x, it.z);
      if (d < it.r && d < bd && (it.y === undefined || Math.abs(p.pos.y - it.y) < 3)) { best = it; bd = d; }
    }
    if (best !== this.cur) { this.hold = 0; this.cur = best; }
    if (!best) return;
    const warn = best.warn ? best.warn() : null;
    if (warn) { HUD.prompt(warn, '', null, true); this.hold = 0; return; }
    const label = typeof best.label === 'function' ? best.label() : best.label;
    if (best.hold > 0) {
      if (Input.isHeld('interact')) {
        if (best.interrupt && best.interrupt()) { this.hold = 0; HUD.prompt('Прервано — вас заметили', '', null, true); return; }
        this.hold += dt;
        HUD.prompt(label, 'E', this.hold / best.hold);
        if (this.hold >= best.hold) { this.hold = 0; best.onUse(); }
      } else { this.hold = Math.max(0, this.hold - dt * 2); HUD.prompt(label + (IS_TOUCH ? ' (удерживать)' : ' — удерживать'), 'E', this.hold > 0 ? this.hold / best.hold : null); }
    } else {
      HUD.prompt(label, 'E');
      if (Input.pressed('interact')) best.onUse();
    }
  },
};

// ---------- photo ----------
const _ndc = new THREE.Vector3();
const Photo = {
  toggle(mode = 'photo') {
    if (Cam.mode === mode) { Cam.mode = 'third'; HUD.viewfinder(null); return; }
    if (Cam.mode !== 'third') return;
    Cam.mode = mode;
    Cam.pitch = clamp(Cam.pitch - 0.25, -0.6, 0.6);
    HUD.viewfinder(mode, mode === 'aim' ? 'БИОПСИЙНЫЙ АРБАЛЕТ · дротиков: ' + (Game.state.flags.darts ?? 0) : 'ПОЛЕВАЯ КАМЕРА · ISO 800 · 1/500');
  },
  evaluate(subjects) {
    let best = null;
    for (const s of subjects) {
      if (!s.obj || !s.obj.visible) continue;
      s.obj.getWorldPosition(_ndc);
      _ndc.y += s.lift ?? 1.5;
      const d = camera.position.distanceTo(_ndc);
      _ndc.project(camera);
      if (_ndc.z > 1 || Math.abs(_ndc.x) > 0.85 || Math.abs(_ndc.y) > 0.85) continue;
      const size = (s.size || 4) / d;
      let stars = 1;
      if (size > 0.09 || s.special) stars = 2;
      if (s.special && size > 0.07 && Math.abs(_ndc.x) < 0.45 && Math.abs(_ndc.y) < 0.5) stars = 3;
      if (d > (s.maxDist || 140)) continue;
      const score = stars * 10 + size;
      if (!best || score > best.score) best = { ...s, stars, score, d };
    }
    return best;
  },
  shoot(scene, subjects) {
    Post.render(scene, camera);
    let src = '';
    try {
      const c = document.createElement('canvas'); c.width = 256; c.height = 144;
      const g = c.getContext('2d');
      const W = renderer.domElement.width, H = renderer.domElement.height;
      const tw = Math.min(W, H * 16 / 9), th = tw * 9 / 16;
      g.drawImage(renderer.domElement, (W - tw) / 2, (H - th) / 2, tw, th, 0, 0, 256, 144);
      src = c.toDataURL('image/jpeg', 0.72);
    } catch (e) { src = ''; }
    Sound.sfx('shutter');
    HUD.flash(0.55, 0.3);
    const best = this.evaluate(subjects || []);
    if (!best) { HUD.toast('Кадр сохранён · в кадре никого нет', 2); return null; }
    if (src) Game.state.photos.push({ src, sp: best.sp, stars: best.stars, tag: best.tag || '' });
    HUD.toast(`ФОТО · ${SPECIES[best.sp].name} ${'★'.repeat(best.stars)}${'☆'.repeat(3 - best.stars)}${best.tag ? ' · ' + best.tag : ''}`, 2.6);
    Journal.add(best.sp, 'seen', true);
    if (best.stars >= 2) setTimeout(() => Journal.add(best.sp, 'photo'), 500);
    if (best.stars >= 2 && best.item) setTimeout(() => Journal.add(best.sp, best.item), 1300);
    return best;
  },
};
