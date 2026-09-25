// ============================================================
// 07-settings.js — player settings: audio mix, camera, subtitles, interface
//
// Stored per browser under umbra.settings.v1. The graphics level keeps its
// own key (umbra.gfx) from before settings existed. Every change goes
// through Settings.set(), which saves and calls Settings.apply(key); the
// systems that own a value (Sound, Voice, Cam, HUD) read Settings.v directly.
// ============================================================
const SETTINGS_KEY = 'umbra.settings.v1';
const SETTINGS_DEFAULT = {
  master: 90, music: 70, sfx: 90, amb: 90, voice: 100, voiceOn: true,
  sens: 5, invertY: false, fov: 62, shake: 100, bright: 5,
  subs: true, subSize: 1, subBg: false, hints: true, waypoint: true, fps: false,
};
const Settings = {
  v: { ...SETTINGS_DEFAULT },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (s && typeof s === 'object') for (const k of Object.keys(SETTINGS_DEFAULT)) if (typeof s[k] === typeof SETTINGS_DEFAULT[k]) this.v[k] = s[k];
    } catch (e) { /* storage blocked: defaults for this tab */ }
  },
  save() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.v)); } catch (e) { /* storage blocked */ } },
  set(k, val) {
    if (this.v[k] === val) return;
    this.v[k] = val;
    this.save();
    this.apply(k);
  },
  reset() {
    this.v = { ...SETTINGS_DEFAULT };
    this.save();
    this.apply();
  },
  // look sensitivity: 5 is the original speed, each step is about 19 %
  lookMul() { return Math.pow(2, (this.v.sens - 5) / 4); },
  brightMul() { return 1 + (this.v.bright - 5) * 0.05; },
  apply(k) {
    const all = !k;
    if (all || /^(master|music|sfx|amb|voice)$/.test(k)) { if (typeof Sound !== 'undefined') Sound.applyVolumes(); }
    if (all || k === 'voiceOn') { if (typeof Voice !== 'undefined') { Voice.enabled = this.v.voiceOn; if (!Voice.enabled) Voice.stop(); } }
    if (all || k === 'bright') renderer.toneMappingExposure = 1.05 * this.brightMul();
    if (all || k === 'subSize' || k === 'subBg') {
      document.body.classList.remove('sub-s', 'sub-m', 'sub-l', 'sub-xl');
      document.body.classList.add(['sub-s', 'sub-m', 'sub-l', 'sub-xl'][this.v.subSize] || 'sub-m');
      document.body.classList.toggle('sub-bg', this.v.subBg);
    }
    if (all || k === 'fps') { const f = $('fps'); if (f) f.hidden = !this.v.fps; }
  },
};
Settings.load();
