// ============================================================
// 08-platform.js — the host the page runs on: Yandex Games, or a plain web page
//
// The --target yandex build loads the Yandex Games SDK from /sdk.js before this module. Moderation
// then checks that the game says when it is ready to play (LoadingAPI.ready), marks when the player
// is actually playing (GameplayAPI start/stop), and falls silent and stops while an ad or a
// platform overlay is on screen (game_api_pause / game_api_resume). Without the SDK every call
// here is a no-op, so the rest of the game calls it unconditionally.
//
// Silence is reference-counted by reason (an ad, a hidden tab, the host's pause): the audio clock
// is suspended while any reason holds and resumes when the last one lets go.
// ============================================================

// a fullscreen ad at chapter breaks, where the screen is already black between two chapters.
// Set to false to publish without ads; the platform also rate-limits them on its side.
const ADS = { betweenChapters: true };

const Platform = {
  sdk: null, name: 'web', whenInit: Promise.resolve(),
  _ready: false, _playing: false, _holds: new Set(), _adBusy: false,
  init() {
    if (typeof window === 'undefined' || !window.YaGames) return this.whenInit;
    this.whenInit = window.YaGames.init().then((sdk) => {
      this.sdk = sdk; this.name = 'yandex';
      sdk.on('game_api_pause', () => this.hostPause(true));
      sdk.on('game_api_resume', () => this.hostPause(false));
    }).catch((e) => { this.sdk = null; console.info('UMBRA: Yandex SDK unavailable, running as a plain page', e); });
    return this.whenInit;
  },
  // the title screen is up and answers input: from here on the player can act
  ready() {
    if (this._ready) return;
    this._ready = true;
    this.whenInit.then(() => { try { this.sdk && this.sdk.features.LoadingAPI.ready(); } catch (e) { /* older SDK */ } });
  },
  // true while the player is playing a chapter; false in menus, pauses, loading, ads and hidden tabs
  gameplay(on) {
    on = !!on && !this.held();
    if (on === this._playing) return;
    this._playing = on;
    const g = this.sdk && this.sdk.features.GameplayAPI;
    try { if (g) { if (on) g.start(); else g.stop(); } } catch (e) { /* older SDK */ }
  },
  held() { return this._holds.size > 0; },
  hold(reason, on) {
    const before = this.held();
    if (on) this._holds.add(reason); else this._holds.delete(reason);
    const now = this.held();
    if (now === before) return;
    if (now) this.gameplay(false);
    const ctx = Sound.ctx;
    if (ctx) { try { if (now) ctx.suspend(); else ctx.resume(); } catch (e) { /* closed */ } }
    Music.hold(now);
  },
  // the host covers the game (its own menu, an ad it started): silence it and open the pause menu
  hostPause(p) {
    if (p && !Game.inMenu && !Game.loading) setPaused(true, { quiet: true });
    this.hold('host', p);
  },
  // a fullscreen ad; resolves once it is gone, whether or not one was shown. Sound goes off before
  // the call, as the requirements ask, and comes back when the ad closes or fails.
  interstitial() {
    if (!this.sdk || !ADS.betweenChapters || this._adBusy) return Promise.resolve(false);
    this._adBusy = true;
    this.hold('ad', true);
    return new Promise((resolve) => {
      let done = false, opened = false;
      const end = (shown) => {
        if (done) return;
        done = true; this._adBusy = false; this.hold('ad', false); resolve(!!shown);
      };
      // an SDK that never answers must not leave the player on a black screen
      setTimeout(() => { if (!opened) end(false); }, 6000);
      try {
        this.sdk.adv.showFullscreenAdv({ callbacks: {
          onOpen: () => { opened = true; },
          onClose: (wasShown) => end(wasShown),
          onError: () => end(false),
          onOffline: () => end(false),
        } });
      } catch (e) { end(false); }
    });
  },
};
Platform.init();
