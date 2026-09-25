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
    // a cue that took the player over (or a stop from elsewhere) leaves the flag lying: clear it
    if (this.on && this.file && !Music.playing('menu')) { this.on = false; this.file = false; }
    if (this.on) return;
    // a recorded menu theme wins over the synthesized one
    if (Music.play('menu', { fade: 3 })) { this.on = true; this.file = true; Sound.bed('wind', 0.05, 3); Sound.bed('insects', 0.022, 4); return; }
    const ctx = Sound.ctx;
    if (!ctx) return;
    Music.stop(2);
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
    if (this.file) { this.file = false; Music.stop(fade); return; }
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

// ---------- recorded tracks (web/music/, copied next to the page by build.py) ----------
// Played through <audio> elements, not decoded into the audio graph: that also works when the
// game is opened straight from disk (file://), where fetch() of a local file is refused. Volume
// follows the master and music settings and drops while paused. Loops crossfade their last
// seconds into a fresh copy from the start, so a track that does not loop sample-exactly has no
// seam. Every cue falls back to the synthesized score when its file is missing.
const Music = {
  files: (typeof window !== 'undefined' && window.MUSIC_TRACKS) || {},
  cur: null, fading: [], _dangerOff: 0, _before: null, _held: null,
  has(n) { return !!this.files[n]; },
  playing(n) { return !!(this.cur && this.cur.name === n); },
  gain() { const v = Settings.v; return Game.muted ? 0 : (v.master / 100) * (v.music / 100) * (Game.paused && !Game.inMenu ? 0.35 : 1); },
  _el(src) {
    const a = new Audio(src); a.preload = 'auto'; a.volume = 0;
    if (this._held) this._held.push(a); else a.play().catch(() => {});
    return a;
  },
  _els() {
    const out = [];
    for (const t of [this.cur, ...this.fading]) if (t) { out.push(t.a); if (t.next) out.push(t.next.b); }
    return out;
  },
  // Platform.hold: <audio> elements live outside the audio clock, so an ad or a hidden tab pauses
  // them by hand. Only what was playing resumes; a cue that ended on its own stays ended.
  hold(on) {
    if (on) {
      if (this._held) return;
      this._held = this._els().filter((a) => !a.paused);
      this._held.forEach((a) => a.pause());
    } else if (this._held) {
      const live = new Set(this._els());
      this._held.forEach((a) => { if (live.has(a)) a.play().catch(() => {}); });
      this._held = null;
    }
  },
  play(name, o = {}) {
    if (!this.has(name)) return false;
    if (this.playing(name)) return true;
    this.stop(o.fade ?? 2);
    this.cur = { name, a: this._el(this.files[name]), k: 0, rise: 1 / Math.max(0.05, o.fade ?? 2), loop: o.loop !== false, vol: o.vol ?? 1, next: null };
    return true;
  },
  stop(fade = 2) {
    // any pending hand-back from the danger cue dies with the track (a chapter change, the menu)
    this._dangerOff = 0; this._before = null;
    const t = this.cur;
    if (!t) return;
    this.cur = null;
    t.fall = 1 / Math.max(0.05, fade);
    this.fading.push(t);
  },
  tick(dt) {
    const g = this.gain(), t = this.cur, X = 3;
    if (this._dangerOff > 0) {
      this._dangerOff -= dt;
      if (this._dangerOff <= 0) {
        this._dangerOff = 0;
        const back = this._before; this._before = null;
        if (!(back && this.play(back, { fade: 3 }))) this.stop(4);
      }
    }
    if (t) {
      t.k = Math.min(1, t.k + dt * t.rise);
      const a = t.a;
      if (t.loop && !t.next && isFinite(a.duration) && a.duration > X * 3 && a.currentTime > a.duration - X) t.next = { b: this._el(a.src), k: 0 };
      if (t.next) {
        const n = t.next;
        n.k = Math.max(n.k, Math.min(1, n.b.currentTime / X)); // the new copy's own clock: exact at any frame rate
        n.b.volume = clamp(g * t.vol * n.k, 0, 1);
        a.volume = clamp(g * t.vol * t.k * (1 - n.k), 0, 1);
        if (n.k >= 1) { a.pause(); t.a = n.b; t.next = null; }
      } else a.volume = clamp(g * t.vol * t.k, 0, 1);
      if (!t.loop && a.ended) this.cur = null;
    }
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i];
      f.k -= dt * f.fall;
      const v = clamp(g * f.vol * Math.max(0, f.k), 0, 1);
      f.a.volume = v; if (f.next) f.next.b.volume = v;
      if (f.k <= 0) { f.a.pause(); if (f.next) f.next.b.pause(); this.fading.splice(i, 1); }
    }
  },
  // the danger cue follows HUD.danger (a chase, a charge, being spotted) and lingers a few seconds
  // after the threat is gone, then hands back to whatever loop was playing before
  danger(on) {
    if (!this.has('danger')) return;
    if (on) {
      this._dangerOff = 0;
      if (!this.playing('danger')) { const before = this.cur && this.cur.loop ? this.cur.name : null; this.play('danger', { fade: 1.2 }); this._before = before; }
    } else if (this.playing('danger') && !this._dangerOff) this._dangerOff = 5;
  },
};
