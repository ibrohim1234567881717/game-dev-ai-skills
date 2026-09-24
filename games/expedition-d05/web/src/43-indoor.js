// ============================================================
// 43-indoor.js — walls, doors, line of sight, nav graph, flashlight
// ============================================================
function segBox(ax, az, bx, bz, b) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  const p = [-dx, dx, -dz, dz], q = [ax - b.x0, b.x1 - ax, az - b.z0, b.z1 - az];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return true;
}
function losClear(world, ax, az, bx, bz) {
  for (const b of world.boxes) { if (b.off || b.low || b.seeThrough) continue; if (segBox(ax, az, bx, bz, b)) return false; }
  return true;
}
function buildWalls(world, segs, o = {}) {
  const t = o.t ?? 0.3, h = o.h ?? 3.4;
  const m = o.mat || mat('#3b403b', { rough: 0.9 });
  for (const [x0, z0, x1, z1] of segs) {
    const bx0 = Math.min(x0, x1) - (x0 === x1 ? t / 2 : 0), bx1 = Math.max(x0, x1) + (x0 === x1 ? t / 2 : 0);
    const bz0 = Math.min(z0, z1) - (z0 === z1 ? t / 2 : 0), bz1 = Math.max(z0, z1) + (z0 === z1 ? t / 2 : 0);
    mesh(G.box(bx1 - bx0, h, bz1 - bz0), m, { parent: world.scene, pos: [(bx0 + bx1) / 2, h / 2, (bz0 + bz1) / 2], receive: true });
    world.boxes.push({ x0: bx0, x1: bx1, z0: bz0, z1: bz1 });
  }
}
class Door {
  constructor(world, o) {
    this.world = world;
    const t = 0.34, h = o.h ?? 3.2;
    const horiz = o.z0 === o.z1;
    this.box = horiz ? { x0: Math.min(o.x0, o.x1), x1: Math.max(o.x0, o.x1), z0: o.z0 - t / 2, z1: o.z0 + t / 2 } : { x0: o.x0 - t / 2, x1: o.x0 + t / 2, z0: Math.min(o.z0, o.z1), z1: Math.max(o.z0, o.z1) };
    const b = this.box;
    this.h = h;
    this.mesh = mesh(G.box(b.x1 - b.x0, h, b.z1 - b.z0), o.mat || mat(o.color || '#5a615c', { metal: 0.4, rough: 0.5 }), { parent: world.scene, pos: [(b.x0 + b.x1) / 2, h / 2, (b.z0 + b.z1) / 2], receive: true });
    if (o.stripe) mesh(G.box(horiz ? b.x1 - b.x0 + 0.02 : 0.36, 0.25, horiz ? 0.36 : b.z1 - b.z0 + 0.02), mat('#d9a520', { emissive: '#5a4000', ei: 0.4 }), { parent: this.mesh, pos: [0, -h / 2 + 0.6, 0], cast: false });
    world.boxes.push(b);
    this.open = false;
    this.y = 0;
    this.speed = o.speed ?? 2.4;
    this.cx = (b.x0 + b.x1) / 2; this.cz = (b.z0 + b.z1) / 2;
    world.onUpdate((dt) => {
      const target = this.open ? h - 0.2 : 0;
      this.y = damp(this.y, target, this.speed, dt);
      this.mesh.position.y = h / 2 + this.y;
      b.off = this.y > 2.0;
    });
    if (o.open) this.set(true, true);
  }
  set(open, instant = false) {
    if (this.open === open) return;
    this.open = open;
    if (instant) { this.y = open ? this.h - 0.2 : 0; this.box.off = open; }
    else Sound.sfx(open ? 'door' : 'slam', Sound.vol(Game.player ? dist2d(Game.player.pos.x, Game.player.pos.z, this.cx, this.cz) : 10, 4, 40));
  }
}
class NavGraph {
  constructor(world, nodes, edges) {
    this.world = world;
    this.nodes = nodes; // {id: {x,z}}
    this.adj = {};
    for (const id in nodes) this.adj[id] = [];
    for (const [a, b, door] of edges) { this.adj[a].push({ to: b, door }); this.adj[b].push({ to: a, door }); }
  }
  nearest(x, z) {
    let best = null, bd = 1e9;
    for (const id in this.nodes) {
      const n = this.nodes[id], d = dist2d(x, z, n.x, n.z);
      if (d < bd && losClear(this.world, x, z, n.x, n.z)) { bd = d; best = id; }
    }
    if (!best) for (const id in this.nodes) { const n = this.nodes[id], d = dist2d(x, z, n.x, n.z); if (d < bd) { bd = d; best = id; } }
    return best;
  }
  path(fx, fz, tx, tz) {
    const s = this.nearest(fx, fz), e = this.nearest(tx, tz);
    if (!s || !e) return [];
    const dist = { [s]: 0 }, prev = {}, open = new Set([s]);
    while (open.size) {
      let u = null, ud = 1e9;
      for (const id of open) if (dist[id] < ud) { ud = dist[id]; u = id; }
      open.delete(u);
      if (u === e) break;
      for (const { to, door } of this.adj[u]) {
        if (door && !door.open) continue;
        const nd = ud + dist2d(this.nodes[u].x, this.nodes[u].z, this.nodes[to].x, this.nodes[to].z);
        if (dist[to] === undefined || nd < dist[to]) { dist[to] = nd; prev[to] = u; open.add(to); }
      }
    }
    if (dist[e] === undefined) return null;
    const out = [];
    for (let c = e; c; c = prev[c]) { out.unshift({ x: this.nodes[c].x, z: this.nodes[c].z, id: c }); if (c === s) break; }
    return out;
  }
}
function makeFlashlight(world, intensity = 30) {
  const spot = new THREE.SpotLight('#fff1d6', intensity, 32, 0.46, 0.5, 1.4);
  spot.castShadow = false;
  world.add(spot); world.add(spot.target);
  world.flashlight = spot;
  world.onUpdate(() => {
    const p = Game.player;
    if (!p) return;
    const e = p.eye();
    const fx = -Math.sin(Cam.yaw) * Math.cos(Cam.pitch * 0.5), fz = -Math.cos(Cam.yaw) * Math.cos(Cam.pitch * 0.5);
    spot.position.set(e.x + Math.cos(Cam.yaw) * 0.25, e.y - 0.1, e.z - Math.sin(Cam.yaw) * 0.25);
    spot.target.position.set(e.x + fx * 10, e.y - 0.4 - Math.sin(Cam.pitch) * 4, e.z + fz * 10);
  });
  return spot;
}
// a lure puck the player throws: blinks and beeps, emits noise events
function throwLure(world, o = {}) {
  const p = Game.player;
  const e = p.eye();
  const fx = -Math.sin(Cam.yaw), fz = -Math.cos(Cam.yaw);
  let tx = e.x, tz = e.z;
  for (let d = 0.5; d <= (o.range || 11); d += 0.5) {
    const nx = e.x + fx * d, nz = e.z + fz * d;
    if (!losClear(world, e.x, e.z, nx, nz)) break;
    tx = nx; tz = nz;
  }
  const puck = mesh(G.cyl(0.12, 0.12, 0.06, 10), mat('#222'), { parent: world.scene, pos: [tx, world.groundH(tx, tz) + 0.04, tz], cast: false });
  const led = mesh(G.sphere(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3b2e' }), { parent: puck, pos: [0, 0.05, 0], cast: false });
  const light = new THREE.PointLight('#ff3b2e', 3, 5, 2); light.position.set(0, 0.3, 0); puck.add(light);
  let t = 0, beeps = 0;
  const fn = world.onUpdate((dt) => {
    t += dt;
    led.visible = light.visible = (t % 0.6) < 0.3;
    if (t > beeps * 0.6 && beeps < 10) {
      beeps++;
      Sound.tone(1900, 0.08, 'square', 0.05 * Sound.vol(dist2d(p.pos.x, p.pos.z, tx, tz), 2, 40));
      world.emitNoise(tx, tz, o.radius || 18, 'lure');
    }
    if (t > 7) { world.scene.remove(puck); world.updaters.splice(world.updaters.indexOf(fn), 1); }
  });
  Sound.noise(0.1, 2500, 'bandpass', 0.2);
  return { x: tx, z: tz };
}
