// ============================================================
// 11-music.js — generative menu score
//
// A slow pad in A minor (Am – Fmaj7 – Cadd9 – Em), detuned saw pairs
// through a breathing low-pass, a sub drone under it, and the island
// motif on a soft bell every fourth chord. A distant animal call rises
// from the ambience now and then. Everything is scheduled on the audio
// clock a chord ahead, so a busy main thread cannot make it stutter.
// ============================================================
const MenuMusic = {
  on: false, out: null, drone: null, _t: 0, _i: 0, _timer: null, _callTimer: null,
  CHORDS: [
    [110, 164.81, 220, 261.63],
    [87.31, 130.81, 220, 329.63],
    [130.81, 196, 293.66, 329.63],
    [82.41, 123.47, 196, 246.94],
  ],
  LEN: 9,
  start() {
    const ctx = Sound.ctx;
    if (!ctx || this.on) return;
    this.on = true;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(1, ctx.currentTime + 4);
    this.out.connect(Sound.musicIn);
    // sub drone on A1, slowly swelling
    const d = ctx.createOscillator(); d.type = 'sine'; d.frequency.value = 55;
    const dg = ctx.createGain(); dg.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05; const lg = ctx.createGain(); lg.gain.value = 0.025;
    lfo.connect(lg); lg.connect(dg.gain); d.connect(dg); dg.connect(this.out); d.start(); lfo.start();
    this.drone = [d, lfo];
    this._t = ctx.currentTime + 0.1; this._i = 0;
    this._next();
    this._call();
    Sound.bed('wind', 0.05, 3); Sound.bed('insects', 0.022, 4);
  },
  stop(fade = 1.6) {
    if (!this.on) return;
    this.on = false;
    clearTimeout(this._timer); clearTimeout(this._callTimer);
    const ctx = Sound.ctx, out = this.out, drone = this.drone;
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
    setTimeout(() => { drone.forEach((o) => { try { o.stop(); } catch (e) { /* stopped */ } }); out.disconnect(); }, fade * 1000 + 3200);
    this.out = null;
  },
  _next() {
    if (!this.on) return;
    const ctx = Sound.ctx, t0 = Math.max(ctx.currentTime + 0.05, this._t), len = this.LEN;
    this._chord(this.CHORDS[this._i % this.CHORDS.length], t0, len);
    if (this._i % 4 === 1) this._motif(t0 + 2.5);
    this._t = t0 + len; this._i++;
    this._timer = setTimeout(() => this._next(), Math.max(200, (this._t - ctx.currentTime - 1.5) * 1000));
  },
  _chord(freqs, t0, len) {
    const ctx = Sound.ctx, X = 3.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(1, t0 + X);
    g.gain.setValueAtTime(1, t0 + len); g.gain.linearRampToValueAtTime(0.0001, t0 + len + X);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(380, t0); lp.frequency.linearRampToValueAtTime(980, t0 + len * 0.6); lp.frequency.linearRampToValueAtTime(420, t0 + len + X);
    lp.connect(g); g.connect(this.out);
    for (const f of freqs) for (const det of [-8, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = f < 100 ? 0.022 : 0.016;
      o.connect(og); og.connect(lp); o.start(t0); o.stop(t0 + len + X + 0.2);
    }
  },
  _motif(at) {
    const ctx = Sound.ctx, delay = Math.max(0, at - ctx.currentTime), b = this.out;
    [220, 261.63, 329.63, 293.66].forEach((f, i) => {
      Sound.tone(f * 2, 2.4, 'sine', 0.035, delay + i * 0.9, null, b);
      Sound.tone(f, 2.6, 'triangle', 0.02, delay + i * 0.9, null, b);
    });
  },
  // a far-off call from the valley: low, filtered, on the ambience bus
  _call() {
    if (!this.on) return;
    this._callTimer = setTimeout(() => {
      if (!this.on || !Sound.ctx) return;
      const ctx = Sound.ctx, t = ctx.currentTime;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(96, t); o.frequency.linearRampToValueAtTime(122, t + 0.8); o.frequency.exponentialRampToValueAtTime(70, t + 3);
      o.connect(lp); lp.connect(g); g.connect(Sound.bedBus); o.start(t); o.stop(t + 3.3);
      this._call();
    }, (22 + Math.random() * 20) * 1000);
  },
};
