/* ============================================================
   BRIDGENT — 3D Experience (light / architectural daylight)

   One master value drives everything: progress ∈ [0 .. 1.12].

   The intro is an 8-shot film. The bridge starts as an ordered
   EXPLODED VIEW (parts floating along clean axes) and assembles
   like a precision machine — staggered, eased, with micro-holds.
   The roadway then extends past the bridge into a readable light
   city/infrastructure model that builds up, a subtle network
   activates as a second layer, a slow drone flythrough follows,
   and the camera locks into the hero framing.

   progress windows
     0.00–0.09  exploded establishing
     0.09–0.40  mechanical assembly
     0.40–0.46  completed-bridge hold
     0.46–0.60  road extension
     0.58–0.72  city emerges
     0.70–0.80  network activation
     0.78–0.95  drone flythrough
     0.95–1.00  hero lock
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';

/* ---------- light architectural palette ---------- */
const COL = {
  sky:        0xedf1f5,
  concrete:   0xd8dee3,
  concrete2:  0xc6ced5,
  concreteDk: 0xb4bdc6,
  steel:      0xb6bfc9,
  steelDk:    0x9aa5b1,
  deck:       0xcbd2d9,
  ground:     0xe4e9ee,
  accent:     0x0e9ca8,
  accentBright:0x1fc6d6,
  accentDeep: 0x0e7c82,
  building:   0xd0d8df,
  buildingHi: 0xc0ccd4,
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const win = (x, a, b) => smooth((x - a) / (b - a));
// mechanical ease — firm in/out so parts glide and settle, not float
const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

/* soft round sprite for network glow / pulses (reads on light bg) */
function makeDotTexture(inner) {
  const s = 64, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.4, 'rgba(14,156,168,0.5)');
  grd.addColorStop(1, 'rgba(14,156,168,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default class Experience {
  constructor(container, opts = {}) {
    this.container = container;
    this.tier = opts.tier || 'high';
    this.reducedMotion = !!opts.reducedMotion;
    this.progress = 0;
    this.time = 0;
    this._running = true;
    this._visible = true;

    this._initRenderer();
    this._initScene();
    this._materials();
    this._buildBridge();
    this._buildCity();
    this._buildNetwork();

    this._onResize = this._onResize.bind(this);
    this._tick = this._tick.bind(this);
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', () => {
      this._running = !document.hidden;
      if (this._running) { this._last = performance.now(); this._raf = requestAnimationFrame(this._tick); }
    });

    this.setProgress(this.reducedMotion ? 1 : 0);
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  /* -------------------------------------------------- renderer */
  _initRenderer() {
    const dprCap = this.tier === 'low' ? 1.4 : this.tier === 'mid' ? 1.75 : 2;
    this.renderer = new THREE.WebGLRenderer({ antialias: this.tier !== 'low', alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setClearColor(COL.sky, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (this.tier === 'high') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.container.appendChild(this.renderer.domElement);
  }

  /* -------------------------------------------------- scene / camera / daylight */
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COL.sky);
    this.scene.fog = new THREE.Fog(COL.sky, 120, 420);

    this.camera = new THREE.PerspectiveCamera(40, this.container.clientWidth / this.container.clientHeight, 0.5, 1200);
    this.camera.position.set(46, 26, 60);

    // soft daylight sky/ground bounce
    this.scene.add(new THREE.HemisphereLight(0xdfeaf3, 0xb2bcc6, 1.05));

    // key sun (warm morning light)
    const sun = new THREE.DirectionalLight(0xfff4e4, 2.4);
    sun.position.set(-58, 86, 46);
    if (this.tier === 'high') {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const s = sun.shadow.camera;
      s.left = -110; s.right = 110; s.top = 110; s.bottom = -110; s.near = 10; s.far = 320;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.5;
    }
    this.scene.add(sun);

    // cool fill from opposite side
    const fill = new THREE.DirectionalLight(0xdfeaf4, 0.55);
    fill.position.set(60, 30, -40);
    this.scene.add(fill);

    // ground plane (receives shadow)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshStandardMaterial({ color: COL.ground, roughness: 0.98, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    if (this.tier === 'high') ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _materials() {
    const M = (color, rough, metal) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    this.mat = {
      concrete: M(COL.concrete, 0.86, 0.05),
      concrete2: M(COL.concrete2, 0.8, 0.06),
      concreteDk: M(COL.concreteDk, 0.82, 0.05),
      steel: M(COL.steel, 0.36, 0.85),
      steelDk: M(COL.steelDk, 0.42, 0.8),
      deck: M(COL.deck, 0.72, 0.12),
      accent: new THREE.MeshStandardMaterial({ color: COL.accent, roughness: 0.5, metalness: 0.2, emissive: COL.accent, emissiveIntensity: 0.35 }),
    };
  }

  /* ==================================================
     BRIDGE — modular parts, exploded → assembled
     ================================================== */
  _buildBridge() {
    this.bridge = new THREE.Group();
    this.scene.add(this.bridge);
    this.parts = [];

    const deckY = 7, deckW = 9, segN = 12;
    const zNear = 28, zFar = -68, span = zNear - zFar;   // 96
    const segLen = span / segN;
    this._bridge = { deckY, deckW, zNear, zFar, span };

    const shadow = this.tier === 'high';
    const cast = (m) => { if (shadow) { m.castShadow = true; m.receiveShadow = true; } return m; };

    // abutments (ordered exploded: rise from below)
    [zNear + 2, zFar - 2].forEach((z, i) => {
      const m = cast(new THREE.Mesh(new THREE.BoxGeometry(deckW + 4, deckY + 1, 6), this.mat.concreteDk));
      this._addPart(m, v(0, (deckY + 1) / 2, z), e(0, 0, 0), v(0, -22, 0), e(0, 0, 0), 0.09 + i * 0.008, 0.15 + i * 0.008);
    });

    // piers (drop straight down into place)
    const pierZ = [18, -2, -24, -46];
    pierZ.forEach((z, i) => {
      const g = new THREE.Group();
      const shaft = cast(new THREE.Mesh(new THREE.BoxGeometry(3.2, deckY, 3.2), this.mat.concrete));
      shaft.position.y = deckY / 2; g.add(shaft);
      const cap = cast(new THREE.Mesh(new THREE.BoxGeometry(deckW + 2, 1, 4.2), this.mat.concrete2));
      cap.position.y = deckY - 0.1; g.add(cap);
      const t0 = 0.12 + i * 0.016;
      this._addPart(g, v(0, 0, z), e(0, 0, 0), v(0, 26, 0), e(0, 0, 0), t0, t0 + 0.075);
    });

    // longitudinal girders (glide up into place under the deck)
    for (const sx of [-1, 1]) {
      const g = cast(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, span), this.mat.steelDk));
      this._addPart(g, v(sx * (deckW / 2 - 1.1), deckY - 0.9, (zNear + zFar) / 2), e(0, 0, 0),
        v(sx * 20, 4, 0), e(0, 0, sx * 0.25), 0.20, 0.27);
    }

    // deck segments — the hero of the assembly: lifted & tilted in the
    // exploded view, they descend straight down and settle flat, near→far
    this.deckSegs = [];
    for (let i = 0; i < segN; i++) {
      const z = zNear - segLen * (i + 0.5);
      const g = new THREE.Group();
      const slab = cast(new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.8, segLen * 0.98), this.mat.deck));
      g.add(slab);
      // centre lane marking (kept light; network glow comes later)
      const lane = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, segLen * 0.6),
        new THREE.MeshStandardMaterial({ color: 0xeef2f4, roughness: 0.6, metalness: 0 }));
      lane.position.y = 0.42; g.add(lane);
      const t0 = 0.25 + (i / segN) * 0.10;
      const lift = 10 + i * 0.8;
      this._addPart(g, v(0, deckY, z), e(0, 0, 0), v(0, lift, 6), e(0.18, 0, (i % 2 ? 1 : -1) * 0.12), t0, t0 + 0.075);
      this.deckSegs.push(g);
    }

    // edge rails / barriers — slide in laterally from both sides
    for (const sx of [-1, 1]) {
      const rail = cast(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, span * 0.99), this.mat.steel));
      this._addPart(rail, v(sx * (deckW / 2 - 0.2), deckY + 0.9, (zNear + zFar) / 2), e(0, 0, 0),
        v(sx * 26, 0, 0), e(0, 0, 0), 0.345, 0.40);
    }

    // towers (A-frame) — halves lifted & splayed, rotate together upright
    this.towers = [];
    [{ z: -2, h: 30 }, { z: -34, h: 25 }].forEach((td, ti) => {
      const grp = new THREE.Group();
      for (const sx of [-1, 1]) {
        const leg = cast(new THREE.Mesh(new THREE.BoxGeometry(1.4, td.h, 1.4), this.mat.steel));
        leg.position.set(sx * (deckW / 2 + 0.5), td.h / 2, 0);
        leg.rotation.z = sx * 0.08; grp.add(leg);
      }
      const bar = cast(new THREE.Mesh(new THREE.BoxGeometry(deckW + 3.4, 1.2, 1.4), this.mat.steel));
      bar.position.y = td.h * 0.6; grp.add(bar);
      const t0 = 0.22 + ti * 0.03;
      this._addPart(grp, v(0, deckY, td.z), e(0, 0, 0), v(0, 20, 0), e(0, 0.5, 0), t0, t0 + 0.085);
      this.towers.push({ grp, top: td.h, z: td.z });
    });

    // stay cables — extend/slide into tension last (subtle overshoot-free)
    this.cableMats = [];
    [{ z: -2, h: 30 }, { z: -34, h: 25 }].forEach((td) => {
      const n = this.tier === 'low' ? 4 : 6;
      for (let s = 1; s <= n; s++) {
        for (const dir of [-1, 1]) {
          const dz = td.z + dir * s * (span / 24);
          for (const sx of [-1, 1]) {
            const top = new THREE.Vector3(sx * (deckW / 2 + 0.5), td.h * 0.92, td.z);
            const bot = new THREE.Vector3(sx * (deckW / 2 - 0.3), deckY + 0.7, dz);
            const cyl = this._segment(top, bot, 0.06, this.mat.steelDk.clone());
            const t0 = 0.36 + Math.random() * 0.04;
            // cables appear (fade) as they lock — avoids exploded clutter
            cyl.material.transparent = true; cyl.material.opacity = 0;
            this.cableMats.push({ mat: cyl.material, t0, t1: t0 + 0.05 });
            this._addPart(cyl, cyl.position.clone(), e(0, 0, 0), v(sx * 10, 6, 0), e(0, 0, 0), t0, t0 + 0.06, cyl.quaternion.clone());
            this.bridge.add(cyl);
          }
        }
      }
    });
  }

  // register a part with exploded 'from' and assembled 'to' transforms
  _addPart(mesh, toPos, toEuler, offset, spinEuler, t0, t1, baseQuat) {
    const toQuat = (baseQuat ? baseQuat.clone() : new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(toEuler));
    const fromQuat = toQuat.clone().multiply(new THREE.Quaternion().setFromEuler(spinEuler));
    const fromPos = toPos.clone().add(offset);
    mesh.position.copy(fromPos);
    mesh.quaternion.copy(fromQuat);
    if (!mesh.parent) this.bridge.add(mesh);
    this.parts.push({ mesh, fromPos, toPos: toPos.clone(), fromQuat, toQuat, t0, t1 });
  }

  _segment(a, b, r, mat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 6, 1), mat);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  }

  /* ==================================================
     CITY — light infrastructure model beyond the bridge
     ================================================== */
  _buildCity() {
    this.city = new THREE.Group();
    this.scene.add(this.city);
    const zStart = this._bridge.zFar - 6;
    this._cityZ = { start: zStart, end: -280 };

    // --- road network (flat light strips + main axis) ---
    this.roadMats = [];
    const roadMat = () => new THREE.MeshStandardMaterial({ color: 0xdbe1e6, roughness: 0.9, metalness: 0.05, transparent: true, opacity: 0 });
    const roads = new THREE.Group(); this.city.add(roads);
    // main axis continuing the bridge
    const mainLen = zStart - this._cityZ.end;
    const main = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, mainLen), roadMat());
    main.position.set(0, 0.1, (zStart + this._cityZ.end) / 2);
    roads.add(main); this.roadMats.push(main.material);
    // cross streets
    for (let z = zStart - 22; z > this._cityZ.end + 10; z -= 26) {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(200, 0.18, 6), roadMat());
      cross.position.set(0, 0.09, z + (Math.random() - 0.5) * 6);
      roads.add(cross); this.roadMats.push(cross.material);
    }
    // parallel avenues
    for (const x of [-58, -30, 30, 58]) {
      const av = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.18, mainLen * 0.96), roadMat());
      av.position.set(x, 0.09, (zStart + this._cityZ.end) / 2);
      roads.add(av); this.roadMats.push(av.material);
    }

    // --- buildings (instanced, rise from the ground, near→far) ---
    const count = this.tier === 'low' ? 120 : this.tier === 'mid' ? 220 : 320;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: COL.building, roughness: 0.62, metalness: 0.15, vertexColors: false });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    if (this.tier === 'high') { inst.castShadow = true; inst.receiveShadow = true; }
    const cHi = new THREE.Color(COL.buildingHi), cLo = new THREE.Color(COL.building);
    this.buildings = []; this._bd = new THREE.Object3D();
    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 8) {
      const gx = (Math.round((Math.random() - 0.5) * 22) * 6) + (Math.random() - 0.5) * 3;
      const gz = zStart - 8 - Math.random() * (zStart - this._cityZ.end);
      if (Math.abs(gx) < 7) continue;                 // keep the main road corridor clear
      const w = 3 + Math.random() * 6, d = 3 + Math.random() * 6;
      const h = 4 + Math.pow(Math.random(), 1.7) * 42;
      const dist = clamp((zStart - gz) / (zStart - this._cityZ.end), 0, 1); // 0 near → 1 far
      this.buildings.push({ x: gx, z: gz, w, d, h, delay: dist * 0.55 });
      inst.setColorAt(placed, Math.random() < 0.3 ? cHi : cLo);
      placed++;
    }
    inst.count = placed;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this._buildings = inst;
    this.city.add(inst);
    this._cityRevApplied = -1;
  }

  /* ==================================================
     NETWORK — subtle intelligent layer over the roads
     ================================================== */
  _buildNetwork() {
    this.network = new THREE.Group();
    this.scene.add(this.network);
    const zStart = this._cityZ.start, zEnd = this._cityZ.end;

    // nodes at intersections along the main axes
    const nodes = [];
    for (let z = zStart - 10; z > zEnd + 12; z -= 26) {
      for (const x of [0, -30, 30, -58, 58]) {
        if (Math.random() < 0.32) continue;
        nodes.push(new THREE.Vector3(x, 1.4, z + (Math.random() - 0.5) * 4));
      }
    }
    this.netNodes = nodes;

    // edges along axes (nearest neighbour, mostly orthogonal)
    const edges = [], seen = new Set();
    for (let a = 0; a < nodes.length; a++) {
      const ds = [];
      for (let b = 0; b < nodes.length; b++) if (a !== b) ds.push([nodes[a].distanceToSquared(nodes[b]), b]);
      ds.sort((p, q) => p[0] - q[0]);
      for (let n = 0; n < 2; n++) {
        const b = ds[n][1]; if (ds[n][0] > 70 * 70) continue;
        const k = a < b ? a + '_' + b : b + '_' + a;
        if (!seen.has(k)) { seen.add(k); edges.push([a, b]); }
      }
    }
    this.netEdges = edges;

    const lpos = new Float32Array(edges.length * 6);
    edges.forEach((e2, i) => { nodes[e2[0]].toArray(lpos, i * 6); nodes[e2[1]].toArray(lpos, i * 6 + 3); });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    this.edgeMat = new THREE.LineBasicMaterial({ color: COL.accent, transparent: true, opacity: 0 });
    this.network.add(new THREE.LineSegments(lg, this.edgeMat));

    // node dots (sprites read cleanly on light)
    this._dotTex = makeDotTexture('rgba(255,255,255,1)');
    this.nodeSprites = nodes.map((p) => {
      const m = new THREE.SpriteMaterial({ map: this._dotTex, color: COL.accent, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(m); s.position.copy(p); s.scale.setScalar(3.4);
      this.network.add(s); return s;
    });

    // travelling pulses
    this.pulses = [];
    const nP = this.tier === 'low' ? 6 : 14;
    for (let i = 0; i < nP; i++) this.pulses.push({ e: Math.floor(Math.random() * edges.length), t: Math.random(), sp: 0.004 + Math.random() * 0.008 });
    this.pulseSprites = this.pulses.map(() => {
      const m = new THREE.SpriteMaterial({ map: this._dotTex, color: COL.accentBright, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(m); s.scale.setScalar(2.6); this.network.add(s); return s;
    });

    // tower beacons
    this.beacons = this.towers.map((tw) => {
      const m = new THREE.SpriteMaterial({ map: this._dotTex, color: COL.accent, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(m); s.position.set(0, tw.top + 0.6, tw.z); s.scale.setScalar(3.2);
      this.bridge.add(s); return s;
    });
  }

  /* ==================================================
     CAMERA — 8-shot film
     ================================================== */
  get _shots() {
    return [
      { p: 0.00, pos: [48, 27, 62], look: [0, 13, -6] },   // 1 exploded establishing
      { p: 0.20, pos: [34, 17, 42], look: [-2, 9, -18] },  // 2 mechanical assembly (track)
      { p: 0.36, pos: [30, 14, 30], look: [-4, 8, -26] },
      { p: 0.44, pos: [45, 18, 30], look: [-4, 9, -28] },  // 3 completed bridge reveal
      { p: 0.54, pos: [6, 12, 24], look: [0, 6, -78] },    // 4 road extension (down the axis)
      { p: 0.65, pos: [3, 30, -18], look: [0, 5, -150] },  // 5 city emerges (lift)
      { p: 0.75, pos: [40, 52, -58], look: [-6, 5, -160] },// 6 network activation (wide)
      { p: 0.84, pos: [46, 60, -78], look: [-8, 6, -160] },// 7 drone flythrough
      { p: 0.91, pos: [-34, 50, -44], look: [2, 8, -150] },
      { p: 1.00, pos: [42, 22, 48], look: [-6, 11, -22] }, // 8 hero lock
      { p: 1.12, pos: [22, 20, 42], look: [-4, 9, -26] },  // scroll tail
    ];
  }

  _applyCamera(p) {
    const shots = this._shots;
    let i = 0;
    while (i < shots.length - 1 && p > shots[i + 1].p) i++;
    const a = shots[i], b = shots[Math.min(i + 1, shots.length - 1)];
    const t = smooth((p - a.p) / ((b.p - a.p) || 1));
    const L = (u, v2) => u + (v2 - u) * t;
    let px = L(a.pos[0], b.pos[0]), py = L(a.pos[1], b.pos[1]), pz = L(a.pos[2], b.pos[2]);
    const lx = L(a.look[0], b.look[0]), ly = L(a.look[1], b.look[1]), lz = L(a.look[2], b.look[2]);
    if (p >= 0.985 && !this.reducedMotion) {
      const s = smooth((p - 0.985) / 0.015);
      px += Math.sin(this.time * 0.32) * 1.0 * s;
      py += Math.cos(this.time * 0.26) * 0.5 * s;
    }
    this.camera.position.set(px, py, pz);
    this.camera.lookAt(lx, ly, lz);
  }

  /* ==================================================
     STATE — everything as a function of progress
     ================================================== */
  setProgress(p) {
    this.progress = clamp(p, 0, 1.12);
    const P = this.progress;

    // --- bridge assembly ---
    for (const part of this.parts) {
      const lt = easeInOut((P - part.t0) / (part.t1 - part.t0));
      part.mesh.position.lerpVectors(part.fromPos, part.toPos, lt);
      part.mesh.quaternion.slerpQuaternions(part.fromQuat, part.toQuat, lt);
    }
    for (const c of this.cableMats) c.mat.opacity = win(P, c.t0, c.t1);

    // --- road extension ---
    const roadRev = win(P, 0.46, 0.60);
    for (const m of this.roadMats) m.opacity = roadRev * 0.95;

    // --- city rise ---
    this._cityReveal = win(P, 0.58, 0.74);
    this._updateCity(this._cityReveal);

    // --- network activation ---
    this._netReveal = win(P, 0.70, 0.84);
    const nr = this._netReveal;
    if (this.edgeMat) this.edgeMat.opacity = nr * 0.5;
    if (this.mat && this.mat.accent) this.mat.accent.emissiveIntensity = 0.35 + nr * 0.6;
    if (this.beacons) this.beacons.forEach((s) => (s.material.opacity = nr * 0.9));

    if (!this._running || this.reducedMotion) this._applyCamera(this.progress);
  }

  _updateCity(reveal) {
    if (!this._buildings || Math.abs(this._cityRevApplied - reveal) < 0.001) return;
    this._cityRevApplied = reveal;
    const d = this._bd;
    this.buildings.forEach((b, i) => {
      const r = smooth((reveal - b.delay) * 3.2);
      const h = Math.max(0.001, b.h * r);
      d.position.set(b.x, h / 2, b.z);
      d.scale.set(b.w, h, b.d);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this._buildings.setMatrixAt(i, d.matrix);
    });
    this._buildings.instanceMatrix.needsUpdate = true;
  }

  setScroll(s) {
    s = clamp(s, 0, 1);
    this.setProgress(1 + s * 0.12);
    if (this.container) this.container.style.opacity = String(1 - s * 0.85);
  }
  setVisible(v) { this._visible = v; }

  /* ==================================================
     RENDER LOOP
     ================================================== */
  _tick() {
    if (!this._running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.time += dt;

    if (!this.reducedMotion && this._netReveal > 0.01) {
      const base = this._netReveal;
      this.nodeSprites.forEach((s, i) => {
        s.material.opacity = base * (0.6 + 0.4 * Math.sin(this.time * 1.5 + i));
      });
      for (let i = 0; i < this.pulses.length; i++) {
        const pu = this.pulses[i]; pu.t += pu.sp;
        if (pu.t > 1) { pu.t = 0; pu.e = Math.floor(Math.random() * this.netEdges.length); }
        const e2 = this.netEdges[pu.e];
        this.pulseSprites[i].position.lerpVectors(this.netNodes[e2[0]], this.netNodes[e2[1]], pu.t);
        this.pulseSprites[i].material.opacity = base;
      }
    }

    if (this._visible) {
      if (!this.reducedMotion) this._applyCamera(this.progress);
      this.renderer.render(this.scene, this.camera);
    }
    this._raf = requestAnimationFrame(this._tick);
  }

  _onResize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}

/* small vector / euler helpers */
function v(x, y, z) { return new THREE.Vector3(x, y, z); }
function e(x, y, z) { return new THREE.Euler(x, y, z); }
