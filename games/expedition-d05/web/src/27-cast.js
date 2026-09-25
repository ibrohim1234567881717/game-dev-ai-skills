// ============================================================
// 27-cast.js — characters, NPC presentation, companion AI
//
// CHARACTERS is the single source of who looks like what. Swapping in a
// finished model is a registry change, not an AI change:
//   CHARACTER_MODELS.lena = (look, key) => group  // must provide
//   group.userData.anim(dt, speed, state) like makeHuman does.
// ============================================================
const CHARACTERS = {
  ethan: { name: 'Итан Рид', short: 'Итан', role: 'следопыт',
    look: { skin: '#b98d6a', hair: '#3b2a1c', hairStyle: 'short', stubble: '#8e6c52', top: '#5b6a45', sleeves: 'rolled', pants: '#6b5e48', cargo: true, boots: '#4a3524', belt: '#2a241c', pack: true, packColor: '#4a4634', caseLights: true, height: 1.8 } },
  halm: { name: 'Виктор Хальм', short: 'Хальм', role: 'руководитель экспедиции',
    look: { skin: '#c9a489', hair: '#cbc7bf', hairStyle: 'grey', brows: '#a8a49c', moustache: '#bab6ae', top: '#3b3833', coat: '#3b3833', lapel: '#2c2925', collar: '#c2b9a4', pants: '#34312c', boots: '#1d1915', height: 1.84 } },
  lena: { name: 'Лена Арден', short: 'Лена', role: 'генетик',
    look: { female: true, skin: '#e2b89a', hair: '#7a3e22', hairStyle: 'ponytail', glasses: true, top: '#dcd6c6', vest: 'field', vestColor: '#3e6e6b', scarf: '#b04a2e', pants: '#4b4a3d', boots: '#5a4030', bag: '#6a4a2e', height: 1.68 },
    variants: { lab: { vest: null, scarf: null, bag: null, coat: '#e9e9e3', top: '#e9e9e3', sleeve: '#e9e9e3', lapel: '#d6d6cf', coatLen: 0.52, pants: '#3a3d44' } } },
  diego: { name: 'Диего Рамос', short: 'Диего', role: 'охрана',
    look: { skin: '#9c7250', hair: '#171210', hairStyle: 'buzz', stubble: '#4a3628', top: '#2b2d29', vest: 'tactical', vestColor: '#4a4b3a', pants: '#3b3c33', kneepads: true, gloves: '#1c1c1a', boots: '#3a3226', helmet: '#3d4033', goggles: true, rifle: true, holster: 'R', bulk: 1.1, height: 1.86 } },
  lucas: { name: 'Лукас Ортис', short: 'Лукас', role: 'пилот',
    look: { skin: '#b58b68', hair: '#241a12', hairStyle: 'short', top: '#7a846c', pants: '#7a846c', flightsuit: true, patch: '#d0662e', headset: true, sunglasses: true, gloves: '#3a3028', boots: '#1e1c1a', height: 1.78 },
    variants: { flight: { headset: false, sunglasses: false, pilotHelmet: '#dcdad2' } } },
  yusuf: { name: 'Юсуф', short: 'Юсуф', role: 'техник', look: { skin: '#a87a58', hair: '#2a1e16', beard: '#2a1e16', top: '#2f5f8a', pants: '#2f5f8a', flightsuit: true, beanie: '#6a2a2a', boots: '#222222', height: 1.76 } },
  tech: { name: 'Техник ORIGO', short: 'Техник', role: 'станция «Порог»', look: { skin: '#d0a888', hair: '#3a2a1e', top: '#4a5a66', pants: '#3a4650', flightsuit: true, cap: '#2a3440', boots: '#222222' } },
};
const CHARACTER_MODELS = {};
function makeCharacter(key, variant) {
  const k = CHARACTERS[key] ? key : 'tech';
  const c = CHARACTERS[k];
  const look = { ...c.look, ...((variant && c.variants && c.variants[variant]) || {}) };
  const g = (CHARACTER_MODELS[k] || makeHuman)(look, k);
  g.userData.castKey = k;
  return g;
}
function makeNPC(key, variant) { return makeCharacter(key, variant); }
function lookYaw(obj, target) {
  const a = Math.atan2(target.x - obj.position.x, target.z - obj.position.z);
  return clamp(wrapAngle(a - obj.rotation.y), -1.1, 1.1);
}

// ---------- idle presentation, look-at, nameplates ----------
const _tagV = new THREE.Vector3();
const Cast = {
  trail: [], pool: [],
  reset() { this.trail.length = 0; this.pool.forEach((el) => { el.hidden = true; }); },
  get(world, key) { return world && world.cast ? world.cast.find((m) => m.userData.castKey === key) : null; },
  update(world, dt) {
    const P = Game.player;
    if (P) { const l = this.trail[this.trail.length - 1]; if (!l || dist2d(l.x, l.z, P.pos.x, P.pos.z) > 2.5) { this.trail.push({ x: P.pos.x, z: P.pos.z }); if (this.trail.length > 60) this.trail.shift(); } }
    if (world.companions) for (const c of world.companions) c.update(dt);
    if (!world.cast) return;
    const sp = HUD.speaking;
    let speaker = null;
    if (sp && sp.key && !sp.radio) speaker = (sp.key === 'ethan' && P) ? P.model : world.cast.find((m) => m.userData.castKey === sp.key && m.visible) || null;
    this.speakerObj = speaker;
    for (const m of world.cast) {
      const u = m.userData;
      if (!m.visible || u.scripted || u.companion) continue;
      const talk = !!(sp && !sp.radio && sp.key === u.castKey);
      let target = null;
      if (speaker && speaker !== m && m.position.distanceTo(speaker.position) < 14) target = speaker.position;
      else if (P && dist2d(m.position.x, m.position.z, P.pos.x, P.pos.z) < 7) target = P.pos;
      const posed = u.pose && u.pose.lookY !== undefined;
      u.anim(dt, 0, { ...(u.pose || {}), talk, lookY: posed ? u.pose.lookY : target ? lookYaw(m, target) : 0 });
    }
  },
  tags(world) {
    const root = $('tags');
    let i = 0;
    const P = Game.player;
    const show = world && world.cast && P && !Cine.active && !$('hud').hidden && Cam.mode === 'third';
    if (show) {
      const sp = HUD.speaking;
      for (const m of world.cast) {
        if (!m.visible || m.userData.noTag) continue;
        const d = dist2d(m.position.x, m.position.z, P.pos.x, P.pos.z);
        if (d > 10) continue;
        m.getWorldPosition(_tagV);
        _tagV.y += (m.userData.height || 1.78) * (m.userData.pose && m.userData.pose.sit ? 0.78 : 1.13);
        _tagV.project(camera);
        if (_tagV.z > 1 || Math.abs(_tagV.x) > 0.95 || Math.abs(_tagV.y) > 0.95) continue;
        let el = this.pool[i];
        if (!el) { el = document.createElement('div'); el.className = 'tag'; root.appendChild(el); this.pool[i] = el; }
        i++;
        const key = m.userData.castKey, c = CHARACTERS[key];
        if (el.dataset.k !== key) { el.dataset.k = key; el.innerHTML = `<b>${c.name}</b>${c.role ? `<small>${c.role}</small>` : ''}`; }
        const x = (_tagV.x * 0.5 + 0.5) * window.innerWidth, y = (-_tagV.y * 0.5 + 0.5) * window.innerHeight;
        el.hidden = false;
        el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
        el.style.opacity = clamp((10 - d) / 3, 0, 1).toFixed(2);
        el.classList.toggle('talk', world.interactables.some((it) => it.npc === key && it.enabled()));
        el.classList.toggle('speaking', !!(sp && !sp.radio && sp.key === key));
      }
    }
    for (; i < this.pool.length; i++) this.pool[i].hidden = true;
  },
  // a spot near the player that the camera cannot see — for recovery teleports only
  hiddenSpot(world) {
    const P = Game.player;
    camera.getWorldDirection(_tagV);
    for (let k = this.trail.length - 1; k >= 0; k--) {
      const c = this.trail[k], d = dist2d(c.x, c.z, P.pos.x, P.pos.z);
      if (d < 7 || d > 24) continue;
      const vx = c.x - camera.position.x, vz = c.z - camera.position.z;
      if (vx * _tagV.x + vz * _tagV.z < 0 && companionFree(world, c.x, c.z, 0.4)) return c;
    }
    for (let k = this.trail.length - 1; k >= 0; k--) { const c = this.trail[k]; if (dist2d(c.x, c.z, P.pos.x, P.pos.z) >= 7 && companionFree(world, c.x, c.z, 0.4)) return c; }
    return null;
  },
};

function companionFree(w, x, z, r) {
  for (const c of w.circles) { if (c.comp) continue; if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false; }
  for (const b of w.boxes) { if (b.off) continue; if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false; }
  if (w.bounds && dist2d(x, z, w.bounds.x, w.bounds.z) > w.bounds.r - 0.5) return false;
  const g = w.groundH(x, z);
  if (w.blocked && w.blocked(x, z, g)) return false;
  if (w.waterY - g > 0.65) return false; // companions wade but never swim
  return true;
}

// ---------- companion AI ----------
// modes: hold (stand at a spot), follow (keep beside the player),
// lead (walk a path ahead, wait for the player), script (goTo for staging)
class Companion {
  constructor(world, g, o = {}) {
    this.world = world; this.g = g; this.key = g.userData.castKey;
    g.userData.companion = this;
    this.pos = new THREE.Vector2(g.position.x, g.position.z);
    this.yaw = g.rotation.y; this.speed = 0; this.vel = 0;
    this.mode = 'hold'; this.hold = { x: this.pos.x, z: this.pos.y, yaw: this.yaw };
    this.path = []; this.side = o.side ?? 1; this.dist = o.dist ?? 2.6;
    this.stuck = 0; this.sidestep = 0; this.sideDir = 1; this.progT = 0; this.progD = Infinity;
    this.waitT = 0; this.callT = 0; this.gestureT = 0; this.gestureKind = null; this.pointYaw = 0;
    this.col = { x: this.pos.x, z: this.pos.y, r: 0.35, comp: true };
    world.circles.push(this.col);
    (world.companions ||= []).push(this);
    this.st = {};
  }
  place(x, z, yaw = this.yaw) { this.pos.set(x, z); this.yaw = yaw; this.g.position.set(x, this.world.groundH(x, z), z); this.g.rotation.y = yaw; this.col.x = x; this.col.z = z; }
  setHold(x = this.pos.x, z = this.pos.y, yaw = null) { this.mode = 'hold'; this.hold = { x, z, yaw }; this._resolve(); }
  follow(o = {}) { this.mode = 'follow'; if (o.dist) this.dist = o.dist; this._resolve(); }
  lead(points, o = {}) {
    this.mode = 'lead'; this.path = points.map(([x, z]) => ({ x, z }));
    this.onArrive = o.onArrive || null; this.calls = o.calls || null; this.waitDist = o.wait ?? 12; this.waitT = 0; this.callT = 6;
    this._resolve();
  }
  goTo(x, z, o = {}) {
    this._resolve();
    return new Promise((res) => { this.mode = 'script'; this.path = [{ x, z }]; this.run = !!o.run; this.face = o.face ?? null; this.scriptT = 0; this.scriptMax = o.timeout ?? 25; this._res = res; });
  }
  _resolve() { const r = this._res; this._res = null; if (r) r(); }
  // walk a list of points in order (doorways, corners); resolves at the last one
  async walk(points, o = {}) { for (const [x, z] of points) { await this.goTo(x, z, o); if (this.detached) return; } }
  // swap the visual (costume change, a finished model) without touching the AI state
  swapModel(ng) {
    const og = this.g, w = this.world;
    ng.position.copy(og.position); ng.rotation.copy(og.rotation);
    if (og.parent) og.parent.remove(og);
    if (w.cast) { const i = w.cast.indexOf(og); if (i >= 0) w.cast.splice(i, 1); }
    w.add(ng);
    ng.userData.companion = this; og.userData.companion = null;
    this.g = ng;
    return ng;
  }
  // hand the figure back to plain scene control (seated in a vehicle, cutscene staging)
  detach() {
    this._resolve();
    this.detached = true;
    const w = this.world;
    const i = w.companions.indexOf(this); if (i >= 0) w.companions.splice(i, 1);
    const j = w.circles.indexOf(this.col); if (j >= 0) w.circles.splice(j, 1);
    this.g.userData.companion = null;
  }
  gesture(kind, target, dur = 1.8) {
    this.gestureKind = kind; this.gestureT = dur;
    if (target) this.pointYaw = wrapAngle(Math.atan2(target.x - this.pos.x, target.z - this.pos.y) - this.yaw);
  }
  update(dt) {
    const w = this.world, P = Game.player;
    if (!this.g.visible) return;
    const pp = P ? P.pos : null;
    const dP = pp ? dist2d(this.pos.x, this.pos.y, pp.x, pp.z) : 99;
    let tx = null, tz = null, want = 0, faceTo = null, crouch = false;
    if (this.mode === 'hold') {
      if (dist2d(this.pos.x, this.pos.y, this.hold.x, this.hold.z) > 0.5) { tx = this.hold.x; tz = this.hold.z; want = 3.0; }
      faceTo = this.hold.yaw !== null && this.hold.yaw !== undefined ? null : pp && dP < 9 ? pp : null;
    } else if (this.mode === 'follow' && pp) {
      // slot beside the player and slightly behind them: never between the camera and the player
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), rx = fz, rz = -fx;
      const side = Math.sign((this.pos.x - pp.x) * rx + (this.pos.y - pp.z) * rz) || this.side;
      let sx = pp.x + rx * side * this.dist - fx * 0.9, sz = pp.z + rz * side * this.dist - fz * 0.9;
      if (!companionFree(w, sx, sz, 0.4)) { const ox = pp.x - rx * side * this.dist - fx * 0.9, oz = pp.z - rz * side * this.dist - fz * 0.9; if (companionFree(w, ox, oz, 0.4)) { sx = ox; sz = oz; } else { sx = pp.x - fx * 2.6; sz = pp.z - fz * 2.6; } }
      const ds = dist2d(this.pos.x, this.pos.y, sx, sz);
      const settled = !P.moving && dP < 5.5 && dP > 1.3 && !this._inCameraLine();
      if (!settled && ds > 0.7) {
        tx = sx; tz = sz;
        want = ds > 10 || (P.speed > 5 && ds > 2) ? 6.4 : ds > 4 ? 4.6 : 3.3 * Math.min(1, ds / 1.4);
        if (P.crouch && ds < 12) { crouch = true; want = Math.min(want, 2.0); }
      } else { faceTo = pp; crouch = P.crouch; }
      if (dP > 55) this._recover();
    } else if (this.mode === 'lead' && pp) {
      const n = this.path[0];
      if (!n) {
        this.mode = 'hold'; this.hold = { x: this.pos.x, z: this.pos.y, yaw: null };
        const cb = this.onArrive; this.onArrive = null; if (cb) cb();
      } else if (dP > this.waitDist || (this.waitT > 0 && dP > this.waitDist * 0.65)) {
        // wait for the player, face them, wave, then call out
        this.waitT += dt; faceTo = pp;
        if (this.waitT > 3 && this.waitT < 4.6) this.gesture('wave', null, 0.2);
        this.callT -= dt;
        if (this.waitT > 7 && this.callT <= 0 && this.calls && !HUD.radioBusy()) { HUD.say([this.calls[(this._ci = ((this._ci ?? -1) + 1)) % this.calls.length]]); this.callT = 22; }
      } else {
        this.waitT = 0;
        tx = n.x; tz = n.z;
        want = (P.speed > 5 && dP < 7) ? 5.4 : 3.0;
        if (dist2d(this.pos.x, this.pos.y, n.x, n.z) < 1.4) this.path.shift();
      }
    } else if (this.mode === 'script') {
      const n = this.path[0];
      this.scriptT += dt;
      if (n && this.scriptT > this.scriptMax) this.place(n.x, n.z);
      if (!n || dist2d(this.pos.x, this.pos.y, n.x, n.z) < 0.45) {
        this.path.length = 0; this.mode = 'hold'; this.hold = { x: this.pos.x, z: this.pos.y, yaw: this.face };
        this._resolve();
      } else { tx = n.x; tz = n.z; want = this.run ? 5.6 : 2.9; }
    }
    // ---- steering ----
    let moved = 0;
    if (tx !== null && want > 0.05) {
      let dx = tx - this.pos.x, dz = tz - this.pos.y;
      const d = Math.hypot(dx, dz);
      dx /= d; dz /= d;
      if (this.sidestep > 0) { this.sidestep -= dt; const sx = -dz * this.sideDir, sz = dx * this.sideDir; dx = dx * 0.3 + sx; dz = dz * 0.3 + sz; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
      // look ahead and bend around obstacles
      const probe = 1.3;
      if (!companionFree(w, this.pos.x + dx * probe, this.pos.y + dz * probe, 0.35)) {
        let found = false;
        for (const a of [0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.1, -2.1]) {
          const aa = a * this.sideDir, c = Math.cos(aa), s = Math.sin(aa);
          const ex = dx * c - dz * s, ez = dx * s + dz * c;
          if (companionFree(w, this.pos.x + ex * probe, this.pos.y + ez * probe, 0.35)) { dx = ex; dz = ez; found = true; break; }
        }
        if (!found) this.sideDir *= -1;
      }
      // personal space: never walk into the player (so they are never pushed)
      if (pp && this.mode !== 'script') {
        const ax = this.pos.x - pp.x, az = this.pos.y - pp.z, al = Math.hypot(ax, az);
        if (al < 1.4 && al > 0.01) { const k = (1.4 - al) * 2.5; dx += (ax / al) * k; dz += (az / al) * k; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
      }
      const v = Math.min(want, d * 2.4);
      const nx = this.pos.x + dx * v * dt, nz = this.pos.y + dz * v * dt;
      if (companionFree(w, nx, nz, 0.3)) { this.pos.set(nx, nz); moved = v; }
      else if (companionFree(w, nx, this.pos.y, 0.3)) { this.pos.x = nx; moved = v * 0.7; }
      else if (companionFree(w, this.pos.x, nz, 0.3)) { this.pos.y = nz; moved = v * 0.7; }
      if (moved > 0.2) this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 9, dt);
      // stuck detection: no progress toward the target for 2.5 s
      this.progT += dt;
      if (d < this.progD - 0.6) { this.progD = d; this.progT = 0; this.stuck = 0; }
      if (this.progT > 2.5) { this.progT = 0; this.progD = d; this.stuck++; this.sidestep = 1.1; this.sideDir *= -1; if (this.stuck > 3 && (this.mode === 'follow' || this.mode === 'lead') && dP > 14) this._recover(); }
    } else { this.progD = Infinity; this.progT = 0; }
    // keep out of the camera's view line when standing close
    if (this.mode === 'follow' && moved < 0.1 && this._inCameraLine()) { const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); const s = this.side; const nx = this.pos.x + fz * s * 1.2 * dt, nz = this.pos.y - fx * s * 1.2 * dt; if (companionFree(w, nx, nz, 0.3)) { this.pos.set(nx, nz); moved = 1.2; } }
    this.speed = damp(this.speed, moved, 8, dt);
    if (faceTo && moved < 0.3) this.yaw = dampAngle(this.yaw, Math.atan2(faceTo.x - this.pos.x, faceTo.z - this.pos.y), 3, dt);
    else if (moved < 0.3 && this.mode === 'hold' && this.hold.yaw !== null && this.hold.yaw !== undefined) this.yaw = dampAngle(this.yaw, this.hold.yaw, 3, dt);
    this.col.x = this.pos.x; this.col.z = this.pos.y;
    this.g.position.set(this.pos.x, w.groundH(this.pos.x, this.pos.y), this.pos.y);
    this.g.rotation.y = this.yaw;
    // ---- animation ----
    this.gestureT -= dt;
    const sp = HUD.speaking, talk = !!(sp && !sp.radio && sp.key === this.key);
    let lookY = 0;
    const spk = Cast.speakerObj;
    if (spk && spk !== this.g) lookY = lookYaw(this.g, spk.position);
    else if (pp && dP < 8) lookY = lookYaw(this.g, pp);
    const g = this.gestureT > 0 ? this.gestureKind : null;
    this.g.userData.anim(dt, this.speed, { ...(this.g.userData.pose || {}), crouch, talk, lookY, point: g === 'point', wave: g === 'wave', pointYaw: this.pointYaw });
  }
  _inCameraLine() {
    const P = Game.player; if (!P) return false;
    const ax = camera.position.x, az = camera.position.z, bx = P.pos.x, bz = P.pos.z;
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
    if (l2 < 0.01) return false;
    const t = ((this.pos.x - ax) * vx + (this.pos.y - az) * vz) / l2;
    if (t < 0.05 || t > 0.95) return false;
    return Math.hypot(ax + vx * t - this.pos.x, az + vz * t - this.pos.y) < 0.8;
  }
  _recover() {
    const s = Cast.hiddenSpot(this.world);
    if (!s) return;
    this.place(s.x, s.z, this.yaw);
    this.stuck = 0; this.sidestep = 0;
  }
}
