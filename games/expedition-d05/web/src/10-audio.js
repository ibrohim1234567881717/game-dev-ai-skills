// ============================================================
// 10-audio.js — synthesized ambience, music and effects
// ============================================================
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
    this.master.gain.value = Game.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
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
  },
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
      g.connect(am); am.connect(this.master);
    } else g.connect(this.master);
    src.start();
    return { gain: g, filter: f, target: level };
  },
  _tone(freq, type, lp, level, freq2) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = level;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
    [freq, freq2].filter(Boolean).forEach((fr) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr; o.connect(f); o.start(); });
    f.connect(g); g.connect(this.master);
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
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
  },
  // one-shots
  _env(node, t, a, peak, dcy) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); },
  tone(freq, dur = 0.3, type = 'sine', vol = 0.2, delay = 0, slideTo) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); this._env(g, t, 0.01, vol, dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.1);
  },
  noise(dur = 0.2, freq = 1000, type = 'lowpass', vol = 0.3, delay = 0, q = 0.7) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = this._noiseSrc(); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); this._env(g, t, 0.005, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.1);
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
    [220, 261.63, 329.63, 293.66].forEach((f, i) => { this.tone(f, 1.6 * slow, 'triangle', vol, i * 0.55 * slow); this.tone(f / 2, 1.8 * slow, 'sine', vol * 0.6, i * 0.55 * slow); });
  },
  theme(vol = 0.09) {
    const seq = [[220, 0], [261.63, 0.5], [329.63, 1], [293.66, 1.5], [329.63, 2.4], [392, 2.9], [440, 3.4], [392, 4.4], [329.63, 5.2]];
    seq.forEach(([f, t]) => { this.tone(f, 1.8, 'triangle', vol, t); this.tone(f * 1.5, 1.8, 'sine', vol * 0.35, t); });
    [110, 130.81, 146.83, 164.81].forEach((f, i) => this.tone(f, 2.2, 'sawtooth', vol * 0.25, i * 1.5));
  },
};
