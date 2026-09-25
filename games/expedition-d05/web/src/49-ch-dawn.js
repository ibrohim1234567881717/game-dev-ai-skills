// ============================================================
// 49-ch-dawn.js — Finale: the Ark, the Lighthouse, four endings
// ============================================================
const ENDINGS = {
  transmit: { title: 'Открытый архив', text: 'Луч Маяка расширяется в небо. Архив Варна уходит во все научные сети мира — целиком, вместе с тем, чего боялся Хальм.\n\nНора Квист, станция «Порог», в эфире на весь мир: «То, что вы сейчас получаете, принадлежит всем».\n\nЧерез месяц к Умбре идут корабли десятка флагов. Лена смотрит на них с берега.\n«Мама бы не знала, радоваться или бояться. Я тоже не знаю».' },
  seal: { title: 'Вуаль', text: 'Луч гаснет. Облака сходятся обратно, кольцо за кольцом. Архив стёрт, координаты уничтожены.\n\n«Её больше нет. Архива. Всего», — говорит Лена.\n«Остров есть», — отвечает Итан.\n\nПоследний рассвет над Умброй гаснет под облаками. Королева стоит на скале и ревёт в серое небо. Остров снова исчезает — и остаётся живым.' },
  rosetta: { title: 'Рассвет', text: 'С шестым образцом Ковчег разделяет архив. Патогены стёрты. Библиотека четырёхсот двенадцати видов уходит в мир. Вуаль восстановлена — но над Маяком остаётся одно окно света. «Пепел» деактивирован навсегда.\n\nКовчег проигрывает последнюю запись: «Лена… я знала, что ты прилетишь. Ты всегда приходила туда, куда тебе запрещали».\n\nГод спустя, Тасмания. В заповеднике открывают вольер. Из укрытия выходит тилацин.\nЛена получает письмо без обратного адреса. Внутри — фотография: Королева с детёнышем.' },
  ash: { title: 'Пепел', text: 'Хальм уходит с кейсом. Загрузка доходит до ста процентов.\n\nЗаряды в скважинах срабатывают одновременно. Остров, который вырос из вулкана, вулкан и забирает.\n\nВертолёт Лукаса над океаном. Позади — столб пепла до самого неба. На полу кабины — пять пустых контейнеров.\n\nТишина.' },
};
const LH = { x: 150, z: -64 };

function makeLighthouse(world) {
  const g = new THREE.Group();
  const stone = mat('#2e3136', { rough: 0.9 });
  mesh(G.cyl(6, 9, 12, 10), stone, { parent: g, pos: [0, 6, 0] });
  mesh(G.cyl(4, 6, 60, 10), stone, { parent: g, pos: [0, 42, 0] });
  mesh(G.cyl(2.6, 4, 24, 10), stone, { parent: g, pos: [0, 84, 0] });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; mesh(G.box(1.2, 30, 1.2), stone, { parent: g, pos: [Math.cos(a) * 5.4, 30 + (i % 2) * 8, Math.sin(a) * 5.4], rot: [0, -a, 0.04] }); }
  mesh(G.cyl(6.5, 6.5, 0.6, 16), mat('#3a3e44', { metal: 0.4 }), { parent: g, pos: [0, 96.5, 0] });
  const lamp = mesh(G.sphere(2.2, 16, 12), new THREE.MeshBasicMaterial({ color: '#b8d8ff', toneMapped: false }), { parent: g, pos: [0, 99, 0], cast: false });
  const beamM = new THREE.MeshBasicMaterial({ color: '#86b4ff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const beam = mesh(G.cyl(1.6, 1.2, 900, 16, 1), beamM, { parent: g, pos: [0, 99 + 450, 0], cast: false });
  const light = new THREE.PointLight('#86b4ff', 80, 140, 1.4); light.position.set(0, 99, 0); g.add(light);
  const door = mesh(G.box(3, 4, 0.4), mat('#4a4f56', { metal: 0.5 }), { parent: g, pos: [0, 2, 8.9], cast: false });
  g.position.set(LH.x, world.groundH(LH.x, LH.z) - 0.5, LH.z);
  world.add(g);
  world.circles.push({ x: LH.x, z: LH.z, r: 9.5 });
  g.userData = { beam, beamM, lamp, light };
  return g;
}

CHAPTERS.dawn = {
  create() {
    const world = new World();
    world.floor = () => 0;
    world.ceiling = 5.5;
    world.scene.background = new THREE.Color('#05070a');
    world.grade = { exposure: 1.05, contrast: 1.1, saturation: 0.95, lift: '#030610', gain: '#e6eeff', bloom: 0.95, vignette: 1.1 };
    world.scene.fog = new THREE.Fog('#05070a', 10, 40);
    const hemi = new THREE.HemisphereLight('#6d86a8', '#101418', 0.4); world.add(hemi); world.hemi = hemi; world.baseHemi = 0.4;
    buildWalls(world, [[-10, -10, 10, -10], [-10, 10, -3, 10], [3, 10, 10, 10], [-10, -10, -10, 10], [10, -10, 10, 10]], { mat: mat('#2a2e33', { rough: 0.8 }), h: 6 });
    mesh(G.box(20, 0.1, 20), mat('#1e2226', { rough: 0.6, metal: 0.3 }), { parent: world.scene, pos: [0, -0.05, 0], receive: true, cast: false });
    mesh(G.box(20, 0.2, 20), mat('#15181b'), { parent: world.scene, pos: [0, 6, 0], cast: false });
    // rings of light
    const rings = [3, 5.5, 8].map((r) => { const m = mesh(new THREE.TorusGeometry(r, 0.06, 6, 48), new THREE.MeshBasicMaterial({ color: '#223044' }), { parent: world.scene, pos: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0], cast: false }); return m; });
    const ringLight = new THREE.PointLight('#dfe8ff', 0, 30, 1.4); ringLight.position.set(0, 4, 0); world.add(ringLight);
    // console with six slots
    const con = new THREE.Group(); world.add(con);
    mesh(G.cyl(1.6, 1.9, 1.1, 12), mat('#2c3238', { metal: 0.6, rough: 0.35 }), { parent: con, pos: [0, 0.55, 0] });
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const s = mesh(G.cyl(0.12, 0.12, 0.5, 10), new THREE.MeshStandardMaterial({ color: '#1a2026', emissive: new THREE.Color(i === 5 ? '#b98cff' : '#43ff8a'), emissiveIntensity: 0 }), { parent: con, pos: [Math.cos(a) * 1.1, 1.3, Math.sin(a) * 1.1], cast: false });
      slots.push(s);
    }
    world.circles.push({ x: 0, z: 0, r: 2 });
    // server columns (rise from the floor)
    const cols = [];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; const c = mesh(G.box(0.6, 4.5, 0.6), new THREE.MeshStandardMaterial({ color: '#1c232a', emissive: new THREE.Color('#2a4aa0'), emissiveIntensity: 0.05, metalness: 0.5 }), { parent: world.scene, pos: [Math.cos(a) * 8.4, -4.5, Math.sin(a) * 8.4], cast: false }); cols.push(c); }
    // Varn hologram
    const varn = makeHuman({ outfit: '#86b4ff', pants: '#86b4ff', skin: '#bcd6ff', hair: '#bcd6ff', hat: '#86b4ff' });
    varn.traverse((o) => { if (o.material) { o.material = new THREE.MeshBasicMaterial({ color: '#8fc0ff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }); } });
    varn.position.set(0, 1.2, -3.2); varn.visible = false; world.add(varn);
    // monitor
    const monC = document.createElement('canvas'); monC.width = 512; monC.height = 256;
    const monT = new THREE.CanvasTexture(monC); monT.colorSpace = THREE.SRGBColorSpace;
    const monLines = [];
    const drawMon = () => { const g = monC.getContext('2d'); g.fillStyle = '#04070c'; g.fillRect(0, 0, 512, 256); g.font = '500 20px "IBM Plex Mono", monospace'; monLines.slice(-9).forEach((l, i) => { g.fillStyle = l.c || '#9fd6ea'; g.fillText(l.t, 16, 32 + i * 26); }); monT.needsUpdate = true; };
    drawMon();
    mesh(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshBasicMaterial({ map: monT, toneMapped: false }), { parent: world.scene, pos: [0, 3.2, -9.8], cast: false });
    const mon = (t, c) => { monLines.push({ t, c }); drawMon(); Sound.sfx('ping', 0.4); };
    // companions
    const npc = {};
    [['lena', -3, 4, 2.6], ['halm', 4, 6, -2.4], ['diego', -5, 6, 2.2]].forEach(([k, x, z, ry]) => { const n = makeNPC(k); n.position.set(x, 0, z); n.rotation.y = ry; world.add(n); world.circles.push({ x, z, r: 0.5 }); npc[k] = n; });
    world.onUpdate((dt) => { varn.userData.anim(dt, 0); varn.rotation.y = Math.sin(Game.time * 0.3) * 0.2; rings.forEach((r, i) => { r.rotation.z += dt * (0.1 + i * 0.05); }); });
    Sound.bed('hum', 0.04);
    const order = ['tri', 'rap', 'spi', 'pte', 'rex'];
    const names = { tri: 'TRICERATOPS', rap: 'VELOCIRAPTOR', spi: 'SPINOSAURUS', pte: 'PTERANODON', rex: 'TYRANNOSAURUS' };
    const S = { inserted: 0, total: order.length + (Game.state.dna.eva ? 1 : 0), done: false };
    const ctx = {
      world, allowPhoto: false,
      spawn: { x: 0, z: 8, yaw: Math.PI },
      markers() { return S.done ? [{ x: 0, z: 10, label: 'лифт', goal: true, near: 2.5 }] : [{ x: 0, z: 0, label: 'консоль', cls: 'ark', goal: true, near: 3.2 }]; },
      async start() {
        mon('ARK · STANDBY'); mon('INSERT GENETIC SAMPLES: 0/5');
        HUD.objective('Вставьте контейнеры в Ковчег', `Консоль в центре зала. Шесть гнёзд. Контейнеров у вас: ${S.total}.`);
      },
      update() {},
    };
    world.interact({ x: 0, z: 2.4, r: 2.6, hold: 0.5, label: () => `Вставить контейнер · ${S.inserted + 1}/${S.total}`, enabled: () => S.inserted < S.total && !Cine.active,
      onUse: async () => {
        const i = S.inserted;
        S.inserted++;
        const key = i < 5 ? order[i] : 'eva';
        slots[i < 5 ? i : 5].material.emissiveIntensity = 2.2;
        Sound.sfx('lever'); Sound.sfx('ping');
        Game.state.dna[key] = key === 'eva' ? Game.state.dna.eva : true;
        mon(`${key === 'eva' ? 'EVA-0 · SLOT 6' : names[key]} — VERIFIED`, key === 'eva' ? '#c9a8ff' : '#7dffae');
        if (S.inserted === S.total) await sequence();
      } });
    async function sequence() {
      await wait(1);
      const eva = Game.state.dna.eva;
      Sound.silenceAll(0.5);
      await Cine.play([
        { from: V(0, 2.2, 5), to: V(0, 2.0, 3.6), look: V(0, 1.2, 0), dur: 3, cut: true, fov: 45, onStart: () => { mon('…'); } },
        { from: V(0, 3, 4), look: V(0, 3.2, -9.8), dur: 3, cut: true, fov: 50, onStart: () => { mon('GENETIC SEQUENCE COMPLETE', '#ffffff'); HUD.big('GENETIC SEQUENCE COMPLETE', '', 'ark', 3.2); Sound.motif(1, 0.12); } },
        { from: V(6, 3.5, 6), to: V(-6, 3.5, 6), look: V(0, 1.5, 0), dur: 5, cut: true, fov: 55,
          onStart: () => { mon('ARK PROTOCOL: AUTHENTICATED'); setTimeout(() => mon('DRIFT VALIDATION: PASSED'), 900); setTimeout(() => mon('ECOSYSTEM STATUS: SELF-SUSTAINING'), 1800); setTimeout(() => mon('INITIATING: DAWN', '#86b4ff'), 2700); rings.forEach((r) => r.material.color.set('#dfe8ff')); },
          onUpdate: (k) => { ringLight.intensity = k * 25; cols.forEach((c, i) => { c.position.y = lerp(-4.5, 2.25, clamp(k * 1.4 - i * 0.04, 0, 1)); c.material.emissiveIntensity = 0.05 + k * 0.45; }); } },
        { from: V(1.6, 1.7, 1.6), to: V(1.2, 1.7, 0.4), look: V(0, 2.1, -3.2), dur: 22, cut: true, fov: 42,
          onStart: () => { varn.visible = true; Sound.theme(0.07); HUD.say([
            { who: 'Варн (запись, 1998)', text: 'Если вы это видите, значит, прошло много лет, и остров жив. Значит, у меня получилось.', dur: 4.6 },
            { who: 'Варн', text: 'Этот остров не был найден. В восемьдесят третьем его не было. Мы вырастили его — камень, почву, лес. Чтобы доказать: жизнь, которую мы потеряли, можно вернуть.', dur: 6.4 },
            { who: 'Варн', text: 'В этих пяти животных — архив. Четыреста двенадцать видов, которых убили люди, и способ их вернуть. Я спрятал его в живых, потому что живое нельзя продать целиком.', dur: 6.4 },
            { who: 'Варн', text: 'Контейнеры не примут мёртвое. Тот, кто взял у острова пять образцов, не отняв ни одной жизни, заслуживает права решать. Решение — на вершине Маяка.', dur: 6 },
          ]); } },
        { from: V(0, 3, 4), look: V(0, 3.2, -9.8), dur: 4, cut: true, fov: 50, onStart: () => { mon('VEIL: OFFLINE', '#86b4ff'); HUD.big('VEIL: OFFLINE', 'ВПЕРВЫЕ ЗА 35 ЛЕТ НАД ОСТРОВОМ СОЛНЦЕ', 'ark', 4); } },
        { from: V(-2, 1.8, 7), look: V(4, 1.6, 6), dur: 3, cut: true, fov: 45, onStart: () => { mon('ORIGO UPLINK: 3%', '#ff6a56'); Sound.sfx('alarm'); HUD.say([{ who: 'Диего', text: 'Что это? Что за «аплинк»?', dur: 2.4 }]); } },
        { from: V(1.5, 1.7, 3.5), to: V(2, 1.7, 3.8), look: V(4, 1.6, 6), dur: 16, cut: true, fov: 42,
          onStart: () => { mon('PROTOCOL ASH: ARMED — EXECUTES ON UPLINK 100%', '#ff6a56'); HUD.say([
            { who: 'Хальм', text: 'Архив уходит туда, где он будет под контролем. А заряды в скважинах сделают так, чтобы копия была одна.', dur: 5 },
            { who: 'Лена', text: 'Вы сожжёте остров. Всё это. Их.', dur: 2.6 },
            { who: 'Хальм', text: 'В архиве не только дронт и тилацин, доктор. Варн записал и болезни, от которых нет лекарств. Вы хотите, чтобы это было у любого, у кого есть лаборатория и обида?', dur: 6.2 },
          ]); } },
        { from: V(-3, 1.7, 2), look: V(4, 1.6, 6), dur: 9, cut: true, fov: 45,
          onStart: () => HUD.say([
            { who: 'Кесслер (спутниковый канал)', text: 'Виктор, заканчивайте. Наши вертолёты у Маяка через десять минут.', dur: 3.6 },
            { who: 'Хальм', text: 'Маяк. Там можно остановить загрузку. Если решишь, что я неправ, — иди. Я не буду мешать.', dur: 4.6 },
          ]) },
      ], { skippable: true });
      S.done = true;
      HUD.objective('Поднимитесь на поверхность', 'Лифт у южной стены. Наверху — Маяк и узлы связи ORIGO.');
    }
    world.interact({ x: 0, z: 9, r: 2.2, label: 'Подняться на лифте', enabled: () => S.done, onUse: () => Game.complete('lighthouse', { noCard: true }) });
    return ctx;
  },
};

CHAPTERS.lighthouse = {
  create() {
    const { world } = buildValleyWorld({ time: 'dawn' });
    world.scene.fog.far = 700;
    const tower = makeLighthouse(world);
    // Veil rings opening: a ring of clouds far away
    const nodes = [0, 1, 2].map((i) => {
      const a = (i / 3) * TAU + 0.4, x = LH.x + Math.cos(a) * 16, z = LH.z + Math.sin(a) * 16;
      const g = new THREE.Group();
      mesh(G.box(1.6, 1.8, 1.2), mat('#3a3f44', { metal: 0.5 }), { parent: g, pos: [0, 0.9, 0] });
      mesh(G.cyl(0.05, 0.05, 4, 4), mat('#666'), { parent: g, pos: [0, 3.5, 0] });
      const led = mesh(G.sphere(0.14, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3b2e' }), { parent: g, pos: [0, 5.5, 0], cast: false });
      g.position.set(x, world.groundH(x, z), z); world.add(g); world.circles.push({ x, z, r: 1.2 });
      return { x, z, led, off: false };
    });
    const helis = [0, 1].map((i) => { const h = makeHelicopter({ color: '#1c1f22', stripe: '#7a1a16', label: 'ORIGO', rpm: 1, onGround: false }); world.add(h); return { h, a: i * Math.PI, r: 70 + i * 20, y: 40 + i * 8 }; });
    // stampede
    const herd = [];
    for (let i = 0; i < 9; i++) { const t = makeTriceratops({ scale: i % 4 === 3 ? 0.5 : rnd(0.9, 1.05) }); world.add(t); herd.push({ g: t, off: new THREE.Vector2(rnd(-10, 10), rnd(-6, 6)), phase: 0 }); }
    const stampA = new THREE.Vector2(60, 30), stampB = new THREE.Vector2(230, -150);
    let stampT = -6;
    // the Queen near the tower
    const rex = makeRex(); world.add(rex);
    const Q = { x: LH.x - 40, z: LH.z + 30, yaw: 0, t: 0, cool: 0 };
    rex.userData.stepCb = () => { const d = dist2d(Game.player.pos.x, Game.player.pos.z, Q.x, Q.z); Sound.sfx('step', Sound.vol(d, 8, 120) * 0.8); };
    const S = { pct: 7, nodes: 0, stage: 'nodes', ending: null };
    const ctx = {
      world,
      spawn: { x: LH.x - 20, z: LH.z + 40, yaw: Math.PI * 0.8 },
      markers() {
        if (S.stage === 'nodes') return nodes.filter((n) => !n.off).map((n) => ({ x: n.x, z: n.z, label: 'узел', cls: 'bad', goal: true, near: 2.5 }));
        if (S.stage === 'climb') return [{ x: LH.x, z: LH.z + 10.5, label: 'Маяк', cls: 'ark', goal: true, near: 3 }];
        return [];
      },
      subjects() { return [{ sp: 'rex', obj: rex, size: 12, lift: 4, tag: 'Королева на рассвете', special: true, maxDist: 160 }, ...herd.slice(0, 4).map((h) => ({ sp: 'tri', obj: h.g, size: 7, lift: 2 }))]; },
      async start() {
        Sound.bed('wind', 0.08);
        if (!Music.play('finale', { fade: 3 })) Sound.theme(0.08);
        HUD.big('РАССВЕТ', 'ВУАЛЬ ОТКЛЮЧЕНА', 'ark', 3.5);
        HUD.objective('Отключите узлы связи ORIGO · 0/3', 'Три узла у основания Маяка. Пока идёт загрузка, «Пепел» взведён.');
        HUD.say([{ who: 'Лена (рация)', text: 'Итан, посмотрите на небо… Солнце. Над островом солнце.' }, { who: 'Лукас (рация)', text: 'Вижу вертолёты ORIGO. Два. Я кружу над кальдерой — позовёшь, и я там.' }, { who: 'Лена (рация)', text: 'Земля трясётся. Стада бегут к побережью — все сразу. Осторожно!' }]);
      },
      update(dt) {
        const P = Game.player, pp = P.pos;
        // uplink timer
        if (S.stage === 'nodes') {
          S.pct = Math.min(100, S.pct + dt * 0.52);
          HUD.timer(`ORIGO UPLINK ${Math.floor(S.pct)}% · PROTOCOL ASH ARMED`);
          if (S.pct >= 100) { S.stage = 'ash'; HUD.timer(null); ending('ash'); }
          if (Math.random() < dt * 0.12) { Cam.shake = Math.max(Cam.shake, 0.35); Sound.sfx('thunder', 0.4); }
        }
        // towers, helis, beam
        tower.userData.beamM.opacity = 0.3 + Math.sin(Game.time * 2) * 0.05;
        helis.forEach((h, i) => { h.a += dt * 0.12 * (i ? -1 : 1); h.h.position.set(LH.x + Math.cos(h.a) * h.r, h.y, LH.z + Math.sin(h.a) * h.r); h.h.rotation.y = -h.a + (i ? 0 : Math.PI); h.h.userData.update(dt, 1); });
        nodes.forEach((n) => { n.led.visible = n.off ? false : (Game.time % 0.8) < 0.4; });
        // stampede
        stampT += dt;
        if (stampT > 26) stampT = -4;
        const k = clamp(stampT / 22, 0, 1);
        herd.forEach((h, i) => {
          const c = new THREE.Vector2().lerpVectors(stampA, stampB, clamp(k - i * 0.01, 0, 1));
          const x = c.x + h.off.x, z = c.y + h.off.y;
          const moving = k > 0 && k < 1;
          h.g.visible = moving;
          h.g.position.set(x, world.groundH(x, z), z); h.g.rotation.y = Math.atan2(stampB.x - stampA.x, stampB.y - stampA.y);
          h.g.userData.anim(dt, moving ? 6 : 0, { alert: true });
          if (moving && dist2d(pp.x, pp.z, x, z) < 3.4 && !h.hitCool) { h.hitCool = true; setTimeout(() => { h.hitCool = false; }, 2000); Sound.sfx('thud', 1); if (P.hurt(1, new THREE.Vector3(x, 0, z)) <= 0) Game.fail('Стадо', 'Стада бегут к берегу — не стойте у них на пути', () => ctx.restore()); }
        });
        if (k > 0 && k < 1 && Math.random() < dt * 2) Sound.sfx('step', Sound.vol(dist2d(pp.x, pp.z, herd[0].g.position.x, herd[0].g.position.z), 10, 120) * 0.5);
        // the Queen: roars at the helicopters, charges if you come close
        const d = dist2d(pp.x, pp.z, Q.x, Q.z);
        let sp = 0;
        Q.cool -= dt;
        if (d < 18 && S.stage !== 'end') { sp = 5; const dx = pp.x - Q.x, dz = pp.z - Q.z; Q.x += (dx / d) * sp * dt; Q.z += (dz / d) * sp * dt; Q.yaw = dampAngle(Q.yaw, Math.atan2(dx, dz), 3, dt); if (d < 4.2 && Q.cool <= 0) { Q.cool = 3; Sound.sfx('roar', 1); if (P.hurt(1, new THREE.Vector3(Q.x, 0, Q.z)) <= 0) Game.fail('Королева', 'Держитесь от неё подальше', () => ctx.restore()); } }
        else { Q.yaw = dampAngle(Q.yaw, Math.atan2(helis[0].h.position.x - Q.x, helis[0].h.position.z - Q.z), 1, dt); if (Math.random() < dt * 0.08) Sound.sfx('roar', Sound.vol(d, 10, 200) * 0.7); }
        rex.position.set(Q.x, world.groundH(Q.x, Q.z), Q.z); rex.rotation.y = Q.yaw;
        rex.userData.anim(dt, sp, { roar: sp === 0 && Math.sin(Game.time * 0.4) > 0.9, open: d < 10 });
        HUD.danger(d < 18);
      },
      restore() { Game.player.place(LH.x - 20, LH.z + 40, Math.PI * 0.8); Q.x = LH.x - 40; Q.z = LH.z + 30; },
      dispose() { HUD.timer(null); },
    };
    nodes.forEach((n) => world.interact({ x: n.x, z: n.z, r: 2.4, hold: 1.5, label: 'Отключить узел связи', enabled: () => !n.off && S.stage === 'nodes',
      onUse: () => {
        n.off = true; S.nodes++; Sound.sfx('lever'); Sound.sfx('rejected', 0.6);
        S.pct = Math.max(7, S.pct - 4);
        if (S.nodes < 3) HUD.objective(`Отключите узлы связи ORIGO · ${S.nodes}/3`, 'Загрузка ещё идёт.');
        else { S.stage = 'climb'; HUD.timer(null); HUD.big('ORIGO UPLINK: TERMINATED', '', 'ark', 3); HUD.objective('Поднимитесь на вершину Маяка', 'Дверь у подножия башни. Хальм уже наверху.'); HUD.say([{ who: 'Лена (рация)', text: 'Загрузка остановлена! Итан… Хальм на вершине. Он вас ждёт.' }]); }
      } }));
    world.interact({ x: LH.x, z: LH.z + 10.5, r: 2.6, label: 'Подняться на вершину Маяка', enabled: () => S.stage === 'climb', onUse: () => summit() });
    async function summit() {
      S.stage = 'end';
      HUD.danger(false);
      const top = V(LH.x, world.groundH(LH.x, LH.z) + 97, LH.z);
      const halm = makeNPC('halm'); halm.position.set(LH.x + 3, top.y, LH.z + 2); halm.rotation.y = -2.2; world.add(halm);
      const me = Game.player; me.model.position.set(LH.x - 2, top.y, LH.z + 3); me.model.rotation.y = 1.2;
      await Cine.play([
        { from: V(LH.x + 30, top.y - 60, LH.z + 30), to: V(LH.x + 22, top.y + 4, LH.z + 22), look: () => top, dur: 6, cut: true, fov: 50, onStart: () => Sound.bed('wind', 0.2) },
        { from: V(LH.x - 6, top.y + 2.2, LH.z + 7), look: V(LH.x + 3, top.y + 1.5, LH.z + 2), dur: 8, cut: true, fov: 45, onStart: () => HUD.say([{ who: 'Хальм', text: 'Красиво, правда? Я был здесь пятнадцать лет назад и ни разу не видел солнца. Никто не видел.', dur: 4.6 }, { who: 'Хальм', text: 'Отдай мне кейс, Итан. Я улечу, и больше никто не умрёт. Кроме острова.', dur: 3.6 }]) },
      ], { skippable: true });
      const a1 = await choose('Вершина Маяка', 'Хальм протягивает руку за кейсом', 'Внизу бегут стада. Над кальдерой кружат вертолёты ORIGO. Решать — вам.', [
        { id: 'give', label: 'Отдать кейс Хальму', cls: 'danger' },
        { id: 'no', label: '«Нет». Подойти к пульту', cls: 'primary' },
      ]);
      if (a1 === 'give') return ending('ash');
      await HUD.say([{ who: 'Хальм', text: '<em>(отходит к краю)</em> Тогда решай. Ты заслужил. Варн так и хотел.', dur: 3.6 }]);
      const eva = Game.state.dna.eva;
      const a2 = await choose('Пульт Маяка', 'Что сделать с архивом Варна?', eva ? 'В кейсе шесть образцов. Шестой, ЕВА-0, позволяет разделить архив.' : 'Пять образцов. Шестое гнездо пусто — архив можно только выпустить целиком или стереть.', [
        { id: 'transmit', label: 'TRANSMIT — выпустить архив в мир целиком', cls: 'ark' },
        { id: 'seal', label: 'SEAL — стереть архив, вернуть Вуаль' },
        { id: 'rosetta', label: eva ? 'ROSETTA — только вымершие виды, без патогенов' : 'ROSETTA — нужен шестой образец', cls: eva ? 'eva' : '', disabled: !eva },
      ]);
      ending(a2);
    }
    async function ending(id) {
      S.stage = 'end';
      HUD.timer(null); HUD.danger(false);
      const t = tower.userData;
      const top = V(LH.x, world.groundH(LH.x, LH.z) + 97, LH.z);
      const sky = world.sky.material.uniforms;
      // a recorded ending theme replaces the synthesized stingers in the ending shots. It loops:
      // the ending runs from these shots through the cards into the credits roll, far past one pass.
      const rec = Music.play('ending', { fade: 2.5 });
      const theme = (v) => { if (!rec) Sound.theme(v); }, motif = (s, v) => { if (!rec) Sound.motif(s, v); };
      const shots = {
        transmit: [{ from: V(LH.x + 120, top.y - 20, LH.z + 120), to: V(LH.x + 100, top.y + 10, LH.z + 100), look: () => top.clone().add(V(0, 80, 0)), dur: 9, cut: true, fov: 55, onStart: () => { theme(0.12); }, onUpdate: (k) => { t.beam.scale.set(1 + k * 6, 1, 1 + k * 6); t.beamM.opacity = 0.35 + k * 0.3; } }],
        seal: [{ from: V(LH.x + 120, top.y - 20, LH.z + 120), to: V(LH.x + 110, top.y - 10, LH.z + 110), look: () => top, dur: 9, cut: true, fov: 55, onStart: () => motif(1.4, 0.1), onUpdate: (k) => { t.beamM.opacity = 0.35 * (1 - k); t.light.intensity = 80 * (1 - k); world.scene.fog.far = lerp(700, 90, k); world.scene.fog.color.lerpColors(new THREE.Color('#c7bca8'), new THREE.Color('#5a6068'), k); sky.flash.value = 0; } }],
        rosetta: [{ from: V(LH.x + 120, top.y - 20, LH.z + 120), to: V(LH.x + 90, top.y + 20, LH.z + 90), look: () => top.clone().add(V(0, 60, 0)), dur: 10, cut: true, fov: 55, onStart: () => { theme(0.1); t.beamM.color.set('#ffffff'); }, onUpdate: (k) => { t.beam.scale.set(1 - k * 0.6, 1, 1 - k * 0.6); world.scene.fog.far = lerp(700, 260, k); } }],
        ash: [{ from: V(LH.x + 160, top.y, LH.z + 160), to: V(LH.x + 200, top.y + 40, LH.z + 200), look: () => V(40, 60, -290), dur: 9, cut: true, fov: 55, onStart: () => { Sound.sfx('thunder', 1); Sound.sfx('roar', 0.6); }, onUpdate: (k, dt) => { Cam.shake = Math.max(Cam.shake, 0.6); world.scene.fog.color.lerpColors(new THREE.Color('#c7bca8'), new THREE.Color('#6a2a14'), k); world.scene.fog.far = lerp(700, 160, k); if (Math.random() < dt * 3) Sound.sfx('thud', 0.8); } }],
      };
      await Cine.play(shots[id], { skippable: true });
      Game.state.flags.ending = id;
      writeSave();
      await HUD.fade(1, 1.4);
      HUD.show(false);
      const e = ENDINGS[id];
      await showCard({ eyebrow: 'Концовка', title: e.title, text: e.text });
      const pct = DNA_KEYS.reduce((s, k) => s + Journal.pct(k), 0) / 5;
      await showCard({ eyebrow: 'UMBRA · Expedition D-05', title: 'Конец экспедиции', text: `Образцы: ${dnaCount()}/5${Game.state.dna.eva ? ' + ЕВА-0' : ''}\nСредний журнал по пяти видам: ${Math.round(pct)}%\nФотографий: ${Game.state.photos.length}\n\nДругие концовки открываются другими решениями. Шестой образец — в пещерах, в убежище Мары Линд.\n\nСпасибо, что прошли экспедицию.` });
      openMenu({ credits: true });
    }
    return ctx;
  },
};
