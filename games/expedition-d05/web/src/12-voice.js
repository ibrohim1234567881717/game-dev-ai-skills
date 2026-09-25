// ============================================================
// 12-voice.js — voice-over playback for subtitle lines
// Audio is generated offline (web/voice/, Qwen3-TTS) and embedded by
// build.py as window.VOICE_BANK = { id: { d: seconds, u: dataURL } }.
// A line's id is FNV-1a-32(speakerKey + '|' + rawText) — the same rule
// web/voice/extract_lines.py uses, so regenerated audio keeps matching.
// ============================================================
const VOICE_SPEAKERS = [
  ['Дневник D-04 · Мара Линд', 'mara'], ['Мара Линд', 'mara'], ['Бортовой самописец D-02', 'd02pilot'], ['Эфир · закрытый канал', 'halm'],
  ['Хальм', 'halm'], ['Лена', 'lena'], ['Лукас', 'lucas'], ['Диего', 'diego'], ['Итан', 'ethan'], ['Нора', 'nora'],
  ['Юсуф', 'yusuf'], ['Варн', 'varn'], ['Кесслер', 'kessler'],
];
// build.py can ship the table from voice/voices.json (longest prefix first), so a new speaker is a JSON edit
const _speakerTable = (typeof window !== 'undefined' && Array.isArray(window.VOICE_SPEAKERS) && window.VOICE_SPEAKERS.length) ? window.VOICE_SPEAKERS : VOICE_SPEAKERS;
function speakerKey(who) {
  if (!who) return null;
  let s = who;
  const i = s.indexOf(' (');
  if (i >= 0) s = s.slice(0, i);
  s = s.replace(/^\[|\]$/g, '').trim();
  for (const [p, k] of _speakerTable) if (s.startsWith(p)) return k;
  return null;
}
// radio / intercom / recordings get the band-limited treatment at playback time
function isRadioLine(who) { return !!who && (/\((рация|радио|интерком|спутниковый канал)\)/.test(who) || who.startsWith('[')); }
const _te = new TextEncoder();
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const b of _te.encode(str)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const Voice = {
  bank: (typeof window !== 'undefined' && window.VOICE_BANK) || null,
  buffers: new Map(), pending: new Map(), cur: null, enabled: true,
  count() { return this.bank ? Object.keys(this.bank).length : 0; },
  lookup(who, text) {
    if (!this.bank || !this.enabled) return null;
    const k = speakerKey(who);
    if (!k) return null;
    const id = fnv1a(k + '|' + text);
    const e = this.bank[id];
    return e ? { id, d: e.d, u: e.u } : null;
  },
  _decode(id) {
    if (this.buffers.has(id)) return Promise.resolve(this.buffers.get(id));
    if (this.pending.has(id)) return this.pending.get(id);
    const e = this.bank && this.bank[id];
    if (!e || !Sound.ctx) return Promise.resolve(null);
    // decode the data URL by hand: fetch(data:) can be blocked by a page's connect-src policy
    const p = new Promise((res) => {
      try {
        const b64 = e.u.slice(e.u.indexOf(',') + 1), bin = atob(b64), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        res(u8.buffer);
      } catch (err) { res(null); }
    }).then((ab) => (ab ? Sound.ctx.decodeAudioData(ab) : null)).then((buf) => { if (buf) this.buffers.set(id, buf); this.pending.delete(id); return buf; }).catch(() => { this.pending.delete(id); return null; });
    this.pending.set(id, p);
    return p;
  },
  // decode everything in the background once audio is unlocked
  prefetch() {
    if (!this.bank || this._prefetching) return;
    this._prefetching = true;
    const ids = Object.keys(this.bank);
    let i = 0;
    const step = () => { if (i >= ids.length) return; Promise.all(ids.slice(i, i + 6).map((id) => this._decode(id))).then(() => { i += 6; setTimeout(step, 30); }); };
    step();
  },
  play(v, radio) {
    this.stop();
    if (!Sound.ctx) return;
    const token = { radio, off: 0 };
    this.cur = token;
    this._decode(v.id).then((buf) => {
      if (!buf || this.cur !== token) return;
      token.buf = buf;
      if (radio) { Sound.noise(Math.min(buf.duration, 8), 2400, 'bandpass', 0.018); Sound.sfx('click', 0.25); }
      if (!token.paused) this._start(token);
    });
  },
  _start(token) {
    const ctx = Sound.ctx, buf = token.buf;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = token.radio ? 0.95 : 1.0;
    let head = src;
    if (token.radio) {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      const sh = ctx.createWaveShaper(); sh.curve = Voice._crunch();
      src.connect(hp); hp.connect(lp); lp.connect(sh); head = sh;
    }
    head.connect(g); g.connect(Sound.voiceBus);
    src.start(0, Math.min(token.off, Math.max(0, buf.duration - 0.01)));
    token.src = src; token.t0 = ctx.currentTime - token.off;
    Sound.duck(true);
    src.onended = () => { if (this.cur === token && !token.paused) { this.cur = null; Sound.duck(false); } };
  },
  // the pause menu holds the line where it is and picks it up from the same word
  pause() {
    const c = this.cur;
    if (!c || c.paused) return;
    c.paused = true;
    if (c.src) { c.off = Sound.ctx.currentTime - c.t0; try { c.src.stop(); } catch (e) { /* already stopped */ } c.src = null; }
  },
  resume() {
    const c = this.cur;
    if (!c || !c.paused) return;
    c.paused = false;
    if (c.buf && c.off < c.buf.duration - 0.05) this._start(c);
    else if (c.buf) { this.cur = null; Sound.duck(false); }
  },
  stop() {
    const c = this.cur;
    this.cur = null;
    if (c && c.src) { try { c.src.stop(); } catch (e) { /* already stopped */ } }
    Sound.duck(false);
  },
  _crunch() {
    if (this._curve) return this._curve;
    const n = 256, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
    return (this._curve = c);
  },
};
