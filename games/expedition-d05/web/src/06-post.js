// ============================================================
// 06-post.js — post-processing: bloom, grading, vignette, grain
//
// The scene renders linear HDR into a half-float target; a quarter-res
// bright pass is blurred for bloom; the composite applies grading, then
// three's tone mapping and sRGB conversion (the includes at the end of the
// composite shader) on the way to the screen. Level 0 skips all of it.
// ============================================================
const Post = {
  ready: false, rt: null, b1: null, b2: null,
  grade: { exposure: 1, contrast: 1.06, saturation: 1.08, lift: new THREE.Color(0, 0, 0), gain: new THREE.Color(1, 1, 1), vignette: 0.9, bloom: 0.55, grain: 0.022 },
  _target: null,
  init() {
    if (this.ready) return;
    const HF = THREE.HalfFloatType;
    const samples = renderer.capabilities.isWebGL2 && GFX.level >= 2 ? 4 : 0;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: HF, samples });
    this.b1 = new THREE.WebGLRenderTarget(4, 4, { type: HF });
    this.b2 = new THREE.WebGLRenderTarget(4, 4, { type: HF });
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.bright = new THREE.ShaderMaterial({
      uniforms: { t: { value: null }, thr: { value: 1.0 } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D t; uniform float thr; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(max(c.r, c.g), c.b); float k = smoothstep(thr, thr * 1.9, l); gl_FragColor = vec4(c * k, 1.0); }',
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
        void main(){ vec3 s = texture2D(t, vUv).rgb * 0.2270;
          s += (texture2D(t, vUv + dir * 1.3846).rgb + texture2D(t, vUv - dir * 1.3846).rgb) * 0.3162;
          s += (texture2D(t, vUv + dir * 3.2308).rgb + texture2D(t, vUv - dir * 3.2308).rgb) * 0.0703;
          gl_FragColor = vec4(s, 1.0); }`,
    });
    this.comp = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, bloom: { value: 0.55 }, exposure: { value: 1 }, contrast: { value: 1 }, saturation: { value: 1 },
        lift: { value: new THREE.Color() }, gain: { value: new THREE.Color(1, 1, 1) }, vignette: { value: 0.9 }, grain: { value: 0.02 }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tScene; uniform sampler2D tBloom; uniform float bloom, exposure, contrast, saturation, vignette, grain, time; uniform vec3 lift, gain; uniform vec2 res; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * bloom;
          c *= exposure;
          c = c * gain + lift;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, saturation);
          c = pow(max(c, vec3(0.0)) / 0.18, vec3(contrast)) * 0.18;
          vec2 d = vUv - 0.5; c *= clamp(1.0 - dot(d, d) * vignette, 0.0, 1.0);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor.rgb += (hash(vUv * res + fract(time) * 91.7) - 0.5) * grain;
        }`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.comp);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.ready = true;
    this.resize();
  },
  resize() {
    if (!this.ready) return;
    const v = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt.setSize(v.x, v.y);
    const q = GFX.level >= 2 ? 4 : 5;
    this.b1.setSize(Math.max(1, Math.floor(v.x / q)), Math.max(1, Math.floor(v.y / q)));
    this.b2.setSize(Math.max(1, Math.floor(v.x / q)), Math.max(1, Math.floor(v.y / q)));
    this.comp.uniforms.res.value.set(v.x, v.y);
  },
  setGrade(g) {
    const d = { exposure: 1, contrast: 1.06, saturation: 1.08, lift: '#000000', gain: '#ffffff', vignette: 0.9, bloom: 0.55, grain: 0.022 };
    const o = { ...d, ...(g || {}) };
    this._target = { exposure: o.exposure, contrast: o.contrast, saturation: o.saturation, lift: new THREE.Color(o.lift), gain: new THREE.Color(o.gain), vignette: o.vignette, bloom: o.bloom, grain: o.grain };
  },
  _pass(mat, target) { this.quad.material = mat; renderer.setRenderTarget(target); renderer.render(this.scene, this.cam); },
  render(scene, cam, dt = 0.016) {
    if (GFX.level === 0) { renderer.setRenderTarget(null); renderer.render(scene, cam); return; }
    if (!this.ready) this.init();
    // ease toward the chapter's grade so transitions (caves, storms) don't pop
    const g = this.grade, t = this._target;
    if (t) {
      const k = 1 - Math.exp(-2.5 * dt);
      for (const key of ['exposure', 'contrast', 'saturation', 'vignette', 'bloom', 'grain']) g[key] = lerp(g[key], t[key], k);
      g.lift.lerp(t.lift, k); g.gain.lerp(t.gain, k);
    }
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, cam);
    const u = this.comp.uniforms;
    this.bright.uniforms.t.value = this.rt.texture;
    this._pass(this.bright, this.b1);
    for (let i = 0; i < 2; i++) {
      this.blur.uniforms.t.value = this.b1.texture; this.blur.uniforms.dir.value.set((1 + i) / this.b1.width, 0); this._pass(this.blur, this.b2);
      this.blur.uniforms.t.value = this.b2.texture; this.blur.uniforms.dir.value.set(0, (1 + i) / this.b1.height); this._pass(this.blur, this.b1);
    }
    u.tScene.value = this.rt.texture; u.tBloom.value = this.b1.texture;
    u.bloom.value = g.bloom; u.exposure.value = g.exposure; u.contrast.value = g.contrast; u.saturation.value = g.saturation;
    u.lift.value.copy(g.lift); u.gain.value.copy(g.gain); u.vignette.value = g.vignette; u.grain.value = g.grain; u.time.value = Game.time;
    this._pass(this.comp, null);
  },
  // switch quality level at runtime
  apply(level) {
    GFX.level = level;
    try { localStorage.setItem('umbra.gfx', String(level)); } catch (e) { /* storage blocked */ }
    renderer.setPixelRatio(pixelRatioFor(level));
    if (this.ready) { this.rt.dispose(); this.b1.dispose(); this.b2.dispose(); this.ready = false; }
    resize();
    const w = Game.world || menuWorld;
    if (w && w.sun) { const ms = [512, 1024, 2048][level]; w.sun.shadow.mapSize.set(ms, ms); if (w.sun.shadow.map) { w.sun.shadow.map.dispose(); w.sun.shadow.map = null; } }
  },
};
