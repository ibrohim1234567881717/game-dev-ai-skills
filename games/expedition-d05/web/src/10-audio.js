// ============================================================
// 10-audio.js — synthesized ambience, music and effects
// ============================================================
const _lsnF = new THREE.Vector3(), _lsnU = new THREE.Vector3();
const Sound = {
  ctx: null, master: null, noiseBuf: null,
  beds: {}, musicGain: null, droneOsc: [],
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    // buses. Everything heard "in the world" goes through one low-pass that muffles it while the
    // game is paused; menu sounds bypass it. Ambience beds duck under dialogue on bedBus, and the
    // player's ambience volume sits after the duck on ambBus. Each bus's level is a setting.
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.Q.value = 0.5;
    this.worldGain = ctx.createGain(); this.muffle.connect(this.worldGain); this.worldGain.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.connect(this.muffle);
    this.bedBus = ctx.createGain(); this.bedBus.connect(this.ambBus);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.muffle);
    this.voiceBus = ctx.createGain(); this.voiceBus.connect(this.muffle);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.muffle);
    this.uiBus = ctx.createGain(); this.uiBus.connect(this.master);
    // music gets a synthesized hall: dry into the bus, a send through a noise-burst impulse response
    this.musicIn = ctx.createGain(); this.musicIn.connect(this.musicBus);
    const verb = ctx.createConvolver(), irLen = Math.floor(ctx.sampleRate * 3.2), ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2); }
    verb.buffer = ir;
    const send = ctx.createGain(); send.gain.value = 0.55;
    this.musicIn.connect(send); send.connect(verb); verb.connect(this.musicBus);
    this.applyVolumes();
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.5 + b * 3; }
    this.noiseBuf = buf;
    // ambience beds
    this.beds.wind = this._bed('lowpass', 420, 0.7, 0);
    this.beds.insects = this._bed('bandpass', 4600, 9, 0, 22);
    this.beds.rain = this._bed('highpass', 1200, 0.5, 0);
    this.beds.water = this._bed('bandpass', 700, 1.2, 0);
    this.beds.hum = this._tone(55, 'sawtooth', 180, 0);
    this.beds.drone = this._tone(41.2, 'sawtooth', 240, 0, 41.6);
    if (typeof Voice !== 'undefined') Voice.prefetch();
  },
  duck(on) {
    if (!this.ctx || !this.bedBus) return;
    this.bedBus.gain.setTargetAtTime(on ? 0.5 : 1, this.ctx.currentTime, on ? 0.12 : 0.5);
  },
  // levels from Settings (0–100 each); the master also carries the M-key mute
  // a reset changes every level at once: queue one update per tick instead of one per setting
  applyVolumes() {
    if (!this.ctx || this._volQueued) return;
    this._volQueued = true;
    setTimeout(() => { this._volQueued = false; this._applyVolumes(); }, 0);
  },
  _applyVolumes() {
    const v = Settings.v, t = this.ctx.currentTime, set = (node, val) => { node.gain.cancelScheduledValues(t); node.gain.setTargetAtTime(val, t, 0.05); };
    set(this.master, Game.muted ? 0 : 0.9 * (v.master / 100));
    set(this.ambBus, v.amb / 100);
    set(this.sfxBus, v.sfx / 100);
    set(this.voiceBus, 1.15 * (v.voice / 100));
    set(this.musicBus, v.music / 100);
    set(this.uiBus, 0.8 * (v.sfx / 100));
  },
  // pause: the world goes muffled and quieter, menu sounds stay clear
  pauseMuffle(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.muffle.frequency.setTargetAtTime(on ? 650 : 20000, t, on ? 0.08 : 0.2);
    this.worldGain.gain.setTargetAtTime(on ? 0.45 : 1, t, 0.12);
  },
  // interface sounds: short, dry, on their own bus
  ui(kind) {
    if (!this.ctx) return;
    const b = this.uiBus;
    switch (kind) {
      case 'move': this.tone(1480, 0.035, 'sine', 0.03, 0, null, b); this.noise(0.018, 3800, 'bandpass', 0.028, 0, 4, b); break;
      case 'ok': this.tone(740, 0.08, 'triangle', 0.07, 0, null, b); this.tone(1109, 0.12, 'triangle', 0.055, 0.05, null, b); break;
      case 'back': this.tone(660, 0.1, 'triangle', 0.055, 0, 470, b); break;
      case 'tick': this.tone(1250, 0.025, 'sine', 0.035, 0, null, b); this.noise(0.012, 5200, 'highpass', 0.02, 0, 0.7, b); break;
      case 'deny': this.tone(150, 0.14, 'square', 0.03, 0, 120, b); break;
      case 'tab': this.noise(0.05, 2400, 'bandpass', 0.05, 0, 2, b); this.tone(880, 0.05, 'sine', 0.03, 0.01, null, b); break;
      case 'title': this.tone(110, 2.2, 'sine', 0.13, 0, null, b); this.tone(220, 1.8, 'triangle', 0.05, 0.05, null, b); this.tone(1760, 1.2, 'sine', 0.018, 0.1, 1320, b); this.noise(1.6, 900, 'lowpass', 0.05, 0, 0.7, b); break;
      case 'start': this.tone(55, 2.4, 'sine', 0.3, 0, 38, b); this.noise(1.8, 520, 'lowpass', 0.14, 0, 0.8, b); this.tone(220, 1.6, 'triangle', 0.04, 0.1, null, b); this.tone(329.6, 1.6, 'triangle', 0.03, 0.25, null, b); break;
    }
  },
  // ---------- positional audio ----------
  emitters: [],
  listen(cam) {
    if (!this.ctx) return;
    const L = this.ctx.listener, p = cam.position;
    cam.getWorldDirection(_lsnF);
    _lsnU.set(0, 1, 0).applyQuaternion(cam.quaternion);
    if (L.positionX) {
      L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
      L.forwardX.value = _lsnF.x; L.forwardY.value = _lsnF.y; L.forwardZ.value = _lsnF.z;
      L.upX.value = _lsnU.x; L.upY.value = _lsnU.y; L.upZ.value = _lsnU.z;
    } else if (L.setPosition) { L.setPosition(p.x, p.y, p.z); L.setOrientation(_lsnF.x, _lsnF.y, _lsnF.z, _lsnU.x, _lsnU.y, _lsnU.z); }
    for (let i = this.emitters.length - 1; i >= 0; i--) this.emitters[i]._tick(p);
  },
  // looping positional source; kinds: 'heli' (rotor + turbine), 'gen' (generator hum), 'fire'
  emitter(kind, o = {}) {
    const dummy = { setPos() {}, setLevel() {}, setRate() {}, stop() {}, _tick() {}, dead: true };
    if (!this.ctx) return dummy;
    const ctx = this.ctx, S = this;
    const out = ctx.createGain(); out.gain.value = 0;
    const air = ctx.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 9000;
    const pan = ctx.createPanner();
    pan.panningModel = QUALITY ? 'HRTF' : 'equalpower'; pan.distanceModel = 'inverse';
    pan.refDistance = o.ref ?? 6; pan.rolloffFactor = o.rolloff ?? 1.1; pan.maxDistance = 1000;
    out.connect(air); air.connect(pan); pan.connect(this.sfxBus);
    const srcs = [];
    const noise = (type, f, q, gain) => { const s = this._noiseSrc(); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); s.start(0, Math.random()); srcs.push(s); return { s, fl, g }; };
    const osc = (type, f, gain) => { const s = ctx.createOscillator(); s.type = type; s.frequency.value = f; const g = ctx.createGain(); g.gain.value = gain; s.connect(g); s.start(); srcs.push(s); return { s, g }; };
    let rate = 1;
    const e = { dead: false, level: o.level ?? 1, pos: new THREE.Vector3(), near: 0 };
    if (kind === 'heli') {
      // blade slap: band-limited noise, amplitude-modulated at the blade-pass rate
      const thump = noise('bandpass', 170, 0.9, 1.0);
      const am = ctx.createGain(); am.gain.value = 0.35;
      const lfo = osc('sawtooth', 18, 0.65); lfo.g.connect(am.gain);
      thump.g.connect(am); am.connect(out);
      const wash = noise('lowpass', 700, 0.5, 0.55); wash.g.connect(out);
      const whine = osc('sine', 1300, 0.035); const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 1300; whine.g.connect(wf); wf.connect(out);
      e.setRate = (r) => {
        rate = clamp(r, 0, 1.2);
        const t = ctx.currentTime;
        lfo.s.frequency.setTargetAtTime(2.5 + rate * 16, t, 0.1);
        whine.s.frequency.setTargetAtTime(380 + rate * 980, t, 0.2); wf.frequency.setTargetAtTime(380 + rate * 980, t, 0.2);
        whine.g.gain.setTargetAtTime(0.012 + rate * 0.03, t, 0.2);
        thump.fl.frequency.setTargetAtTime(90 + rate * 110, t, 0.1);
        wash.g.gain.setTargetAtTime(0.1 + rate * 0.5, t, 0.2);
      };
    } else if (kind === 'gen') {
      const hum = osc('sawtooth', 50, 0.12); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; hum.g.connect(f); f.connect(out);
      const rattle = noise('bandpass', 900, 3, 0.18); rattle.g.connect(out);
      e.setRate = (r) => { rate = r; hum.s.frequency.setTargetAtTime(35 + r * 15, ctx.currentTime, 0.3); };
    } else if (kind === 'fire') {
      const crackle = noise('highpass', 2000, 0.6, 0.35); crackle.g.connect(out);
      const roar = noise('lowpass', 300, 0.5, 0.6); roar.g.connect(out);
      e.setRate = (r) => { rate = r; };
    } else e.setRate = (r) => { rate = r; };
    e.setPos = (v) => { e.pos.copy(v); if (pan.positionX) { pan.positionX.value = v.x; pan.positionY.value = v.y; pan.positionZ.value = v.z; } else pan.setPosition(v.x, v.y, v.z); };
    e.setLevel = (v) => { e.level = v; };
    e._tick = (lp) => {
      if (e.dead) return;
      const d = lp.distanceTo(e.pos);
      // air absorption: distant engines lose their top end
      air.frequency.value = 900 + 8100 * Math.exp(-d / 90);
      const lvl = e.level * clamp(rate * 1.4, 0, 1) * (o.gain ?? 1);
      out.gain.setTargetAtTime(Game.muted ? 0 : lvl, ctx.currentTime, 0.08);
    };
    e.stop = (fade = 1.2) => {
      if (e.dead) return;
      e.dead = true;
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, Math.max(0.05, fade / 4));
      setTimeout(() => { srcs.forEach((s) => { try { s.stop(); } catch (err) { /* stopped */ } }); out.disconnect(); pan.disconnect(); }, fade * 1000 + 200);
      const i = S.emitters.indexOf(e); if (i >= 0) S.emitters.splice(i, 1);
    };
    e.setRate(o.rate ?? 1);
    this.emitters.push(e);
    return e;
  },
  stopEmitters(fade = 0.6) { [...this.emitters].forEach((e) => e.stop(fade)); },
  _noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; return s; },
  _bed(type, freq, q, level, amRate) {
    const ctx = this.ctx, src = this._noiseSrc();
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = level;
    src.connect(f); f.connect(g);
    if (amRate) {
      const am = ctx.createGain(); am.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = amRate;
      const lg = ctx.createGain(); lg.gain.value = 0.5;
      lfo.connect(lg); lg.connect(am.gain); lfo.start();
      g.connect(am); am.connect(this.bedBus);
    } else g.connect(this.bedBus);
    src.start();
    return { gain: g, filter: f, target: level };
  },
  _tone(freq, type, lp, level, freq2) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = level;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
    [freq, freq2].filter(Boolean).forEach((fr) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr; o.connect(f); o.start(); });
    f.connect(g); g.connect(this.bedBus);
    return { gain: g, filter: f, target: level };
  },
  bed(name, level, time = 1.5) {
    if (!this.ctx || !this.beds[name]) return;
    const b = this.beds[name];
    if (Math.abs(b.target - level) < 0.001) return;
    b.target = level;
    const t = this.ctx.currentTime;
    b.gain.gain.cancelScheduledValues(t);
    b.gain.gain.setTargetAtTime(level, t, time / 3);
  },
  silenceAll(time = 1) { Object.keys(this.beds).forEach((k) => this.bed(k, 0, time)); },
  setMuted(m) {
    Game.muted = m;
    this.applyVolumes();
  },
  // one-shots: effects bus unless a bus is given (music and interface pass their own)
  _env(node, t, a, peak, dcy) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); },
  tone(freq, dur = 0.3, type = 'sine', vol = 0.2, delay = 0, slideTo, bus) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); this._env(g, t, 0.01, vol, dur);
    o.connect(g); g.connect(bus || this.sfxBus); o.start(t); o.stop(t + dur + 0.1);
  },
  noise(dur = 0.2, freq = 1000, type = 'lowpass', vol = 0.3, delay = 0, q = 0.7, bus) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = this._noiseSrc(); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); this._env(g, t, 0.005, vol, dur);
    s.connect(f); f.connect(g); g.connect(bus || this.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  },
  vol(d, near = 6, far = 90) { return clamp(1 - (d - near) / (far - near), 0, 1); },
  sfx(name, v = 1) {
    if (!this.ctx || v <= 0.01) return;
    switch (name) {
      case 'ping': this.tone(880, 0.12, 'sine', 0.12 * v); this.tone(1320, 0.16, 'sine', 0.1 * v, 0.07); break;
      case 'verified': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.9, 'triangle', 0.12 * v, i * 0.09)); break;
      case 'rejected': this.tone(180, 0.4, 'square', 0.08 * v); this.tone(150, 0.5, 'square', 0.08 * v, 0.18); break;
      case 'shutter': this.noise(0.05, 4000, 'highpass', 0.25 * v); this.noise(0.07, 2500, 'highpass', 0.18 * v, 0.08); break;
      case 'thud': this.tone(70, 0.35, 'sine', 0.5 * v, 0, 40); this.noise(0.25, 300, 'lowpass', 0.5 * v); break;
      case 'crack': this.noise(0.12, 1800, 'bandpass', 0.5 * v, 0, 2); this.tone(90, 0.2, 'sine', 0.4 * v, 0, 50); break;
      case 'grunt': this.tone(95 + Math.random() * 20, 0.5, 'sawtooth', 0.12 * v, 0, 60); this.noise(0.4, 250, 'lowpass', 0.15 * v); break;
      case 'horn': this.tone(110, 1.6, 'sawtooth', 0.08 * v, 0, 98); this.tone(165, 1.6, 'triangle', 0.06 * v, 0.05, 150); break;
      case 'click': this.noise(0.03, 3200, 'bandpass', 0.35 * v, 0, 6); this.noise(0.03, 2600, 'bandpass', 0.3 * v, 0.07, 6); break;
      case 'shriek': this.tone(900, 0.45, 'sawtooth', 0.1 * v, 0, 1500); this.tone(1300, 0.35, 'square', 0.05 * v, 0.1, 700); this.noise(0.4, 2500, 'bandpass', 0.2 * v, 0, 3); break;
      case 'roar':
        this.tone(62, 2.2, 'sawtooth', 0.5 * v, 0, 38); this.tone(93, 2.0, 'sawtooth', 0.3 * v, 0.05, 55);
        this.noise(2.0, 500, 'lowpass', 0.6 * v, 0, 1); this.noise(1.2, 1600, 'bandpass', 0.2 * v, 0.2, 1.5); break;
      case 'step': this.tone(38, 0.5, 'sine', 0.8 * v, 0, 24); this.noise(0.3, 160, 'lowpass', 0.6 * v); break;
      case 'splash': this.noise(0.6, 1400, 'bandpass', 0.4 * v, 0, 0.8); this.noise(0.9, 400, 'lowpass', 0.3 * v, 0.05); break;
      case 'gen': this.noise(0.4, 200, 'lowpass', 0.5 * v); this.tone(48, 0.8, 'sawtooth', 0.2 * v, 0.1, 60); break;
      case 'door': this.noise(0.5, 600, 'lowpass', 0.35 * v, 0, 1); this.tone(140, 0.3, 'square', 0.04 * v, 0.1, 90); break;
      case 'slam': this.tone(55, 0.6, 'square', 0.35 * v, 0, 35); this.noise(0.5, 900, 'lowpass', 0.8 * v); break;
      case 'glass': for (let i = 0; i < 5; i++) this.tone(2400 + Math.random() * 2400, 0.25, 'triangle', 0.05 * v, i * 0.04); break;
      case 'thunder': this.noise(3.2, 180, 'lowpass', 0.9 * v, 0, 0.6); this.noise(1.2, 900, 'lowpass', 0.3 * v, 0.05); break;
      case 'wing': this.noise(0.3, 700, 'bandpass', 0.3 * v, 0, 1.4); break;
      case 'whistle': this.tone(1800, 1.2, 'sine', 0.06 * v, 0, 700); break;
      case 'chick': this.tone(1500, 0.12, 'triangle', 0.08 * v, 0, 1900); this.tone(1700, 0.12, 'triangle', 0.08 * v, 0.18, 2100); break;
      case 'drip': this.tone(1400 + Math.random() * 500, 0.08, 'sine', 0.12 * v, 0, 700); break;
      case 'lever': this.noise(0.12, 1200, 'bandpass', 0.4 * v, 0, 3); this.tone(220, 0.15, 'square', 0.06 * v, 0.05); break;
      case 'bolt': this.noise(0.1, 2000, 'bandpass', 0.35 * v, 0, 4); this.tone(300, 0.2, 'triangle', 0.1 * v, 0, 120); break;
      case 'alarm': this.tone(740, 0.35, 'square', 0.06 * v); this.tone(554, 0.35, 'square', 0.06 * v, 0.4); break;
      case 'shot': this.noise(0.16, 2600, 'highpass', 0.6 * v); this.tone(90, 0.25, 'sine', 0.6 * v, 0, 40); this.noise(0.45, 500, 'lowpass', 0.45 * v, 0.02); break;
      case 'rotor': this.noise(0.09, 300, 'lowpass', 0.25 * v); break;
    }
  },
  motif(slow = 1, vol = 0.1) {
    // four-note island motif: A3 C4 E4 D4
    const b = this.musicIn;
    [220, 261.63, 329.63, 293.66].forEach((f, i) => { this.tone(f, 1.6 * slow, 'triangle', vol, i * 0.55 * slow, null, b); this.tone(f / 2, 1.8 * slow, 'sine', vol * 0.6, i * 0.55 * slow, null, b); });
  },
  theme(vol = 0.09) {
    const b = this.musicIn;
    const seq = [[220, 0], [261.63, 0.5], [329.63, 1], [293.66, 1.5], [329.63, 2.4], [392, 2.9], [440, 3.4], [392, 4.4], [329.63, 5.2]];
    seq.forEach(([f, t]) => { this.tone(f, 1.8, 'triangle', vol, t, null, b); this.tone(f * 1.5, 1.8, 'sine', vol * 0.35, t, null, b); });
    [110, 130.81, 146.83, 164.81].forEach((f, i) => this.tone(f, 2.2, 'sawtooth', vol * 0.25, i * 1.5, null, b));
  },
};
