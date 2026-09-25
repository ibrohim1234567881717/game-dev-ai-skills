// ============================================================
// 05-input.js — keyboard, mouse, pointer lock, touch
// ============================================================
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', KeyE: 'interact', KeyF: 'photo', KeyC: 'crouch', ControlLeft: 'crouch',
  KeyJ: 'journal', Tab: 'objective', KeyQ: 'throw', Escape: 'pause', KeyP: 'pause', Space: 'shoot', KeyM: 'mute', Enter: 'confirm',
};
const Input = {
  held: Object.create(null),
  edges: new Set(),
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  locked: false,
  enabled: true,
  mouseDown: false,
  stickId: null, stickOrigin: null, stickVec: { x: 0, y: 0 },
  lookId: null, lookLast: null,
  press(a) { this.edges.add(a); },
  pressed(a) { if (this.edges.has(a)) { this.edges.delete(a); return true; } return false; },
  isHeld(a) { return !!this.held[a]; },
  endFrame() { this.edges.clear(); this.look.x = 0; this.look.y = 0; },
  computeMove() {
    let x = 0, y = 0;
    if (this.held.left) x -= 1; if (this.held.right) x += 1;
    if (this.held.up) y += 1; if (this.held.down) y -= 1;
    if (this.stickId !== null) { x = this.stickVec.x; y = this.stickVec.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this.move.x = x; this.move.y = y;
    return this.move;
  },
  running() {
    if (this.stickId !== null) return Math.hypot(this.stickVec.x, this.stickVec.y) > 0.93;
    return !!this.held.run;
  },
};

window.addEventListener('keydown', (e) => {
  const a = KEYMAP[e.code];
  if (!a) return;
  if (a === 'journal' || a === 'objective' || a === 'shoot' || e.code.startsWith('Arrow')) e.preventDefault();
  if (!e.repeat) Input.press(a);
  Input.held[a] = true;
});
window.addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) Input.held[a] = false; });
window.addEventListener('blur', () => { for (const k in Input.held) Input.held[k] = false; });

// ---------- mouse ----------
canvas.addEventListener('mousedown', (e) => {
  if (IS_TOUCH) return;
  Input.mouseDown = true;
  if (Game.inMenu || Game.paused) return;
  if (Cam.mode === 'photo' || Cam.mode === 'aim') { Input.press('shoot'); return; }
  if (!Input.locked && canvas.requestPointerLock) {
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* optional */ }
  }
});
window.addEventListener('mouseup', () => { Input.mouseDown = false; });
document.addEventListener('pointerlockchange', () => { Input.locked = document.pointerLockElement === canvas; });
window.addEventListener('mousemove', (e) => {
  if (IS_TOUCH) return;
  if (Input.locked || Input.mouseDown) { Input.look.x += e.movementX || 0; Input.look.y += e.movementY || 0; }
});

// ---------- touch ----------
const stickEl = $('stick'), knobEl = $('stickKnob');
function stickCenter() { const r = stickEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, rad: r.width / 2 }; }
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || Game.inMenu) return;
  const w = window.innerWidth;
  if (e.clientX < w * 0.42 && Input.stickId === null) {
    Input.stickId = e.pointerId;
    Input.stickOrigin = stickCenter();
    updateStick(e);
  } else if (Input.lookId === null) {
    Input.lookId = e.pointerId;
    Input.lookLast = { x: e.clientX, y: e.clientY };
  }
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
function updateStick(e) {
  const o = Input.stickOrigin;
  let dx = e.clientX - o.x, dy = e.clientY - o.y;
  const l = Math.hypot(dx, dy), max = o.rad;
  if (l > max) { dx *= max / l; dy *= max / l; }
  Input.stickVec.x = dx / max; Input.stickVec.y = -dy / max;
  knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
}
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch') return;
  if (e.pointerId === Input.stickId) updateStick(e);
  else if (e.pointerId === Input.lookId) {
    Input.look.x += (e.clientX - Input.lookLast.x) * 2.2;
    Input.look.y += (e.clientY - Input.lookLast.y) * 2.2;
    Input.lookLast = { x: e.clientX, y: e.clientY };
  }
});
function endTouch(e) {
  if (e.pointerId === Input.stickId) { Input.stickId = null; Input.stickVec.x = Input.stickVec.y = 0; knobEl.style.transform = ''; }
  if (e.pointerId === Input.lookId) Input.lookId = null;
}
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

document.querySelectorAll('.tbtn').forEach((b) => {
  const a = b.dataset.action;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Input.press(a); Input.held[a] = true; b.classList.add('on'); });
  const up = () => { Input.held[a] = false; b.classList.remove('on'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
});
