/* ============================================================
   BRIDGENT — 3D Experience (light / architectural daylight)

   One master value drives everything: progress ∈ [0 .. 1.12].
   The intro is an 8-shot film. Bridge parts begin OUTSIDE the
   frame (hidden) and fly in one after another, settling like a
   precision machine. The roadway then extends into a fine, dense
   light city model that builds up; a clearly readable network
   layer activates; a slow drone flies THROUGH that same city past
   its nodes; then the camera locks into the hero framing.

   progress windows
     0.00–0.05  establishing (empty daylight site)
     0.05–0.44  mechanical assembly (parts fly in from outside)
     0.44–0.50  completed-bridge hold
     0.50–0.62  road extension
     0.60–0.74  city emerges
     0.72–0.86  network activation
     0.80–0.95  drone flythrough (through the city)
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
  accentBright:0x14c6d6,
  accentDeep: 0x0b6f76,
  building:   0xd0d8df,
  buildingHi: 0xbecbd4,
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const win = (x, a, b) => smooth((x - a) / (b - a));
const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

/* soft round sprite for network glow / pulses */
function makeDotTexture() {
  const s = 64, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(20,198,214,0.85)');
  grd.addColorStop(1, 'rgba(14,156,168,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* inlaid "BRIDGENT" lettering laid flat into the deck surface */
function makeWordTexture() {
  const w = 1400, h = 200, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(74,90,104,0.9)';
  g.font = '800 128px Archivo, "IBM Plex Sans", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // letter-spacing by drawing per glyph
  const word = 'BRIDGENT', ls = 20;
  let total = 0; const widths = [];
  for (const ch of word) { const m = g.measureText(ch).width; widths.push(m); total += m + ls; }
  total -= ls;
  let x = (w - total) / 2;
  for (let i = 0; i < word.length; i++) { g.fillText(word[i], x + widths[i] / 2, h / 2 + 6); x += widths[i] + ls; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default class Experience {
  constructor(container, opts = {}) {
    this.container = container;
    this.tier = opts.tier || 'high';
    this.reducedMotion = !!opts.reducedMotion;
    this.progress = 0;
    this.time = 0;
    this._scroll = 0;
    this._pageActive = false;   // after the intro: scroll drives a calm fly-over
    this._page = 0;
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
    if (this.tier === 'high') { this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    this.container.appendChild(this.renderer.domElement);
  }

  /* -------------------------------------------------- scene / camera / daylight */
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COL.sky);
    this.scene.fog = new THREE.Fog(COL.sky, 130, 460);

    this.camera = new THREE.PerspectiveCamera(40, this.container.clientWidth / this.container.clientHeight, 0.5, 1400);
    this.camera.position.set(48, 24, 64);

    this.scene.add(new THREE.HemisphereLight(0xdfeaf3, 0xb2bcc6, 1.05));

    const sun = new THREE.DirectionalLight(0xfff4e4, 2.4);
    sun.position.set(-58, 86, 46);
    if (this.tier === 'high') {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const s = sun.shadow.camera;
      s.left = -90; s.right = 90; s.top = 90; s.bottom = -90; s.near = 10; s.far = 300;
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5;
    }
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xdfeaf4, 0.55);
    fill.position.set(60, 30, -40);
    this.scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshStandardMaterial({ color: COL.ground, roughness: 0.98, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
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
    };
  }

  /* ==================================================
     BRIDGE — finely divided; parts fly in from OUTSIDE
     ================================================== */
  _buildBridge() {
    this.bridge = new THREE.Group();
    this.scene.add(this.bridge);
    this.parts = [];

    const deckY = 7, deckW = 9, segN = 20;
    const zNear = 28, zFar = -68, span = zNear - zFar;      // 96
    const segLen = span / segN;
    this._bridge = { deckY, deckW, zNear, zFar, span };

    const shadow = this.tier === 'high';
    const cast = (m) => { if (shadow) { m.castShadow = true; m.receiveShadow = true; } return m; };

    // helper: fromPos is an OFFSET that starts the part outside the frame
    const T = { a: 0.05, b: 0.44 };   // assembly window
    // stagger a value across the assembly window
    const at = (frac, len) => { const s = T.a + (T.b - T.a - len) * frac; return [s, s + len]; };

    // abutments — descend from high above, staggered first
    [zNear + 2, zFar - 2].forEach((z, i) => {
      const m = cast(new THREE.Mesh(new THREE.BoxGeometry(deckW + 4, deckY + 1, 6), this.mat.concreteDk));
      const [t0, t1] = at(0.0 + i * 0.02, 0.09);
      this._addPart(m, v(0, (deckY + 1) / 2, z), e(0, 0, 0), v(0, 150, 0), e(0, 0, 0.2), t0, t1);
    });

    // piers — descend from high, near→far
    const pierZ = [18, 4, -10, -26, -44, -58];
    pierZ.forEach((z, i) => {
      const g = new THREE.Group();
      const shaft = cast(new THREE.Mesh(new THREE.BoxGeometry(3, deckY, 3), this.mat.concrete));
      shaft.position.y = deckY / 2; g.add(shaft);
      const cap = cast(new THREE.Mesh(new THREE.BoxGeometry(deckW + 1.6, 1, 4), this.mat.concrete2));
      cap.position.y = deckY - 0.1; g.add(cap);
      const [t0, t1] = at(0.05 + (i / pierZ.length) * 0.12, 0.07);
      this._addPart(g, v(0, 0, z), e(0, 0, 0), v((i % 2 ? 1 : -1) * 150, 90, 0), e(0, 0, 0), t0, t1);
    });

    // longitudinal girders (segmented into 4) — glide in from far ahead (−Z)
    const girN = 4;
    for (let s = 0; s < girN; s++) {
      const gz = zNear - (s + 0.5) * (span / girN);
      for (const sx of [-1, 1]) {
        const g = cast(new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, span / girN * 0.98), this.mat.steelDk));
        const [t0, t1] = at(0.16 + s * 0.03, 0.07);
        this._addPart(g, v(sx * (deckW / 2 - 1), deckY - 0.9, gz), e(0, 0, 0), v(0, 20, -220), e(0.2, 0, 0), t0, t1);
      }
    }

    // deck segments — the hero of the assembly: glide straight down from
    // high above, near→far, each with its own lane inlay
    this.deckSegs = [];
    for (let i = 0; i < segN; i++) {
      const z = zNear - segLen * (i + 0.5);
      const g = new THREE.Group();
      const slab = cast(new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.7, segLen * 0.98), this.mat.deck));
      g.add(slab);
      const lane = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, segLen * 0.55),
        new THREE.MeshStandardMaterial({ color: 0xeef2f4, roughness: 0.6, metalness: 0 }));
      lane.position.y = 0.37; g.add(lane);
      const [t0, t1] = at(0.30 + (i / segN) * 0.42, 0.06);
      this._addPart(g, v(0, deckY, z), e(0, 0, 0), v(0, 120 + i * 3, 8), e(0.14, 0, (i % 2 ? 1 : -1) * 0.1), t0, t1);
      this.deckSegs.push(g);
    }

    // inlaid BRIDGENT lettering — flush in the deck near the entrance
    const wordTex = makeWordTexture();
    const word = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 1.2),
      new THREE.MeshStandardMaterial({ map: wordTex, transparent: true, roughness: 0.5, metalness: 0.4, emissive: COL.accent, emissiveIntensity: 0.12, polygonOffset: true, polygonOffsetFactor: -1 })
    );
    word.rotation.x = -Math.PI / 2; word.rotation.z = Math.PI;   // read across the deck
    this._addPart(word, v(0, deckY + 0.41, 16), e(-Math.PI / 2, 0, Math.PI), v(0, 40, 0), e(0, 0, 0), ...at(0.74, 0.06));

    // edge rails — per segment, slide in from the sides (alternating L/R)
    const railN = 10;
    for (let i = 0; i < railN; i++) {
      const rz = zNear - (i + 0.5) * (span / railN);
      for (const sx of [-1, 1]) {
        const rail = cast(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, span / railN * 0.96), this.mat.steel));
        const [t0, t1] = at(0.56 + (i / railN) * 0.16, 0.05);
        this._addPart(rail, v(sx * (deckW / 2 - 0.2), deckY + 0.85, rz), e(0, 0, 0), v(sx * 150, 0, 0), e(0, 0, 0), t0, t1);
      }
    }

    // towers (A-frame) — descend from high, splayed, rotate upright
    this.towers = [];
    [{ z: -2, h: 30 }, { z: -34, h: 25 }].forEach((td, ti) => {
      const grp = new THREE.Group();
      for (const sx of [-1, 1]) {
        const leg = cast(new THREE.Mesh(new THREE.BoxGeometry(1.3, td.h, 1.3), this.mat.steel));
        leg.position.set(sx * (deckW / 2 + 0.5), td.h / 2, 0); leg.rotation.z = sx * 0.08; grp.add(leg);
      }
      const bar = cast(new THREE.Mesh(new THREE.BoxGeometry(deckW + 3.4, 1.1, 1.3), this.mat.steel));
      bar.position.y = td.h * 0.6; grp.add(bar);
      const bar2 = cast(new THREE.Mesh(new THREE.BoxGeometry(deckW + 2.6, 0.9, 1.1), this.mat.steelDk));
      bar2.position.y = td.h * 0.34; grp.add(bar2);
      const [t0, t1] = at(0.34 + ti * 0.04, 0.08);
      this._addPart(grp, v(0, deckY, td.z), e(0, 0, 0), v(0, 130, 0), e(0, 0.4, 0), t0, t1);
      this.towers.push({ grp, top: td.h, z: td.z });
    });

    // stay cables — fly in radially from outside and lock into tension last
    this.cableMats = [];
    [{ z: -2, h: 30 }, { z: -34, h: 25 }].forEach((td) => {
      const n = this.tier === 'low' ? 5 : 8;
      for (let s = 1; s <= n; s++) {
        for (const dir of [-1, 1]) {
          const dz = td.z + dir * s * (span / (n * 2 + 4));
          for (const sx of [-1, 1]) {
            const top = new THREE.Vector3(sx * (deckW / 2 + 0.5), td.h * 0.93, td.z);
            const bot = new THREE.Vector3(sx * (deckW / 2 - 0.3), deckY + 0.6, dz);
            const cyl = this._segment(top, bot, 0.055, this.mat.steelDk.clone());
            const [t0, t1] = at(0.82 + Math.random() * 0.1, 0.05);
            this._addPart(cyl, cyl.position.clone(), e(0, 0, 0), v(sx * 90, 40, 0), e(0, 0, 0), t0, t1, cyl.quaternion.clone());
            this.bridge.add(cyl);
          }
        }
      }
    });
  }

  // register a part with a hidden, off-screen 'from' and assembled 'to'
  _addPart(mesh, toPos, toEuler, offset, spinEuler, t0, t1, baseQuat) {
    const toQuat = (baseQuat ? baseQuat.clone() : new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(toEuler));
    const fromQuat = toQuat.clone().multiply(new THREE.Quaternion().setFromEuler(spinEuler));
    const fromPos = toPos.clone().add(offset);
    mesh.position.copy(fromPos);
    mesh.quaternion.copy(fromQuat);
    mesh.visible = false;                       // hidden until it starts flying in
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
     CITY — fine, dense, street-gridded light model
     ================================================== */
  _buildCity() {
    this.city = new THREE.Group();
    this.scene.add(this.city);
    const zStart = this._bridge.zFar - 6;
    const zEnd = -320;
    this._cityZ = { start: zStart, end: zEnd };
    const cell = 5, xMin = -95, xMax = 95;
    const avEvery = 5, csEvery = 6;   // avenue / cross-street spacing (in cells)

    // --- road network aligned to the grid ---
    this.roadMats = [];
    const roadMat = () => new THREE.MeshStandardMaterial({ color: 0xdbe1e6, roughness: 0.9, metalness: 0.05, transparent: true, opacity: 0 });
    const roads = new THREE.Group(); this.city.add(roads);
    const mainLen = zStart - zEnd;
    const main = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, mainLen), roadMat());
    main.position.set(0, 0.11, (zStart + zEnd) / 2); roads.add(main); this.roadMats.push(main.material);
    // avenues (along Z)
    for (let ci = 0, x = xMin; x <= xMax; x += cell, ci++) {
      if (ci % avEvery !== 0 || Math.abs(x) < 6) continue;
      const av = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, mainLen * 0.98), roadMat());
      av.position.set(x, 0.09, (zStart + zEnd) / 2); roads.add(av); this.roadMats.push(av.material);
    }
    // cross streets (along X)
    for (let ri = 0, z = zStart - 4; z > zEnd; z -= cell, ri++) {
      if (ri % csEvery !== 0) continue;
      const cs = new THREE.Mesh(new THREE.BoxGeometry(2 * xMax + 10, 0.18, 3.4), roadMat());
      cs.position.set(0, 0.08, z); roads.add(cs); this.roadMats.push(cs.material);
    }

    // --- buildings: one small block per grid cell, streets left as gaps ---
    const maxCount = this.tier === 'low' ? 320 : this.tier === 'mid' ? 720 : 1350;
    const raw = [];
    for (let ci = 0, x = xMin; x <= xMax; x += cell, ci++) {
      if (ci % avEvery === 0) continue;               // avenue gap
      if (Math.abs(x) < 6) continue;                  // main corridor
      for (let ri = 0, z = zStart - 4; z > zEnd; z -= cell, ri++) {
        if (ri % csEvery === 0) continue;             // cross-street gap
        if (Math.random() < 0.16) continue;           // occasional empty lot
        const w = 2 + Math.random() * 2.3, d = 2 + Math.random() * 2.3;
        const h = 2.5 + Math.pow(Math.random(), 2.0) * 20;
        const dist = clamp((zStart - z) / (zStart - zEnd), 0, 1);
        raw.push({ x: x + (Math.random() - 0.5) * 1.1, z: z + (Math.random() - 0.5) * 1.1, w, d, h, delay: dist * 0.5 });
      }
    }
    // keep it within budget
    for (let i = raw.length - 1; i > 0 && raw.length > maxCount; i--) { if (Math.random() < 0.5) raw.splice(i, 1); }
    const buildings = raw.slice(0, maxCount);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: COL.building, roughness: 0.6, metalness: 0.12 });
    const inst = new THREE.InstancedMesh(geo, mat, buildings.length);
    if (this.tier === 'high') inst.receiveShadow = true;
    const cHi = new THREE.Color(COL.buildingHi), cLo = new THREE.Color(COL.building);
    buildings.forEach((b, i) => inst.setColorAt(i, Math.random() < 0.35 ? cHi : cLo));
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.buildings = buildings; this._buildings = inst; this._bd = new THREE.Object3D();
    this.city.add(inst);
    this._cityRevApplied = -1;
  }

  /* ==================================================
     NETWORK — clearly readable information layer
     ================================================== */
  _buildNetwork() {
    this.network = new THREE.Group();
    this.scene.add(this.network);
    const zStart = this._cityZ.start, zEnd = this._cityZ.end;

    // deterministic hub chain along the main axis (the flythrough passes these)
    const nodes = [];
    this.hubs = [];
    for (let z = zStart - 18; z > zEnd + 20; z -= 30) {
      const hy = 13 + Math.sin(z * 0.05) * 2;
      const h = new THREE.Vector3((Math.sin(z * 0.11) * 6), hy, z);
      nodes.push(h); this.hubs.push(h);
    }
    // secondary nodes over the districts
    for (let z = zStart - 12; z > zEnd + 12; z -= 20) {
      for (const x of [-60, -34, 34, 60]) {
        if (Math.random() < 0.35) continue;
        nodes.push(new THREE.Vector3(x + (Math.random() - 0.5) * 8, 8 + Math.random() * 14, z + (Math.random() - 0.5) * 8));
      }
    }
    this.netNodes = nodes;

    // edges: chain the hubs, connect others to nearest neighbours
    const edges = [], seen = new Set();
    const add = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (!seen.has(k)) { seen.add(k); edges.push([a, b]); } };
    for (let i = 1; i < this.hubs.length; i++) add(i - 1, i);
    for (let a = this.hubs.length; a < nodes.length; a++) {
      const ds = [];
      for (let b = 0; b < nodes.length; b++) if (a !== b) ds.push([nodes[a].distanceToSquared(nodes[b]), b]);
      ds.sort((p, q) => p[0] - q[0]);
      for (let n = 0; n < 2; n++) if (ds[n] && ds[n][0] < 75 * 75) add(a, ds[n][1]);
    }
    this.netEdges = edges;

    const lpos = new Float32Array(edges.length * 6);
    edges.forEach((e2, i) => { nodes[e2[0]].toArray(lpos, i * 6); nodes[e2[1]].toArray(lpos, i * 6 + 3); });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    this.edgeMat = new THREE.LineBasicMaterial({ color: COL.accent, transparent: true, opacity: 0 });
    this.network.add(new THREE.LineSegments(lg, this.edgeMat));

    // clear node knots (solid emissive dots)
    this._dotTex = makeDotTexture();
    const nodeGeo = new THREE.SphereGeometry(0.55, 12, 12);
    this.nodeMat = new THREE.MeshBasicMaterial({ color: COL.accentBright, transparent: true, opacity: 0 });
    const knots = new THREE.InstancedMesh(nodeGeo, this.nodeMat, nodes.length);
    const d = new THREE.Object3D();
    nodes.forEach((p, i) => { d.position.copy(p); const sc = i < this.hubs.length ? 1.6 : 1; d.scale.setScalar(sc); d.updateMatrix(); knots.setMatrixAt(i, d.matrix); });
    knots.instanceMatrix.needsUpdate = true;
    this.knots = knots; this.network.add(knots);

    // node glow sprites (halo)
    this.nodeSprites = nodes.map((p, i) => {
      const m = new THREE.SpriteMaterial({ map: this._dotTex, color: COL.accent, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(m); s.position.copy(p); s.scale.setScalar(i < this.hubs.length ? 5 : 3.2);
      this.network.add(s); return s;
    });

    // travelling pulses — brighter, larger, clearly along the edges
    this.pulses = [];
    const nP = this.tier === 'low' ? 10 : 22;
    for (let i = 0; i < nP; i++) this.pulses.push({ e: Math.floor(Math.random() * edges.length), t: Math.random(), sp: 0.004 + Math.random() * 0.009 });
    this.pulseSprites = this.pulses.map(() => {
      const m = new THREE.SpriteMaterial({ map: this._dotTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(m); s.scale.setScalar(3.4); this.network.add(s); return s;
    });

    // tower beacons
    this.beacons = this.towers.map((tw) => {
      const m = new THREE.SpriteMaterial({ map: this._dotTex, color: COL.accent, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(m); s.position.set(0, tw.top + 0.6, tw.z); s.scale.setScalar(3.4);
      this.bridge.add(s); return s;
    });
  }

  /* ==================================================
     CAMERA — 8-shot film; flythrough goes THROUGH the city
     ================================================== */
  get _shots() {
    return [
      { p: 0.00, pos: [48, 24, 64], look: [0, 8, 8] },     // 1 establishing (empty site)
      { p: 0.16, pos: [34, 16, 42], look: [-2, 9, -14] },  // 2 assembly track
      { p: 0.30, pos: [27, 13, 27], look: [-4, 8, -24] },  // 3 assembly closer
      { p: 0.44, pos: [44, 18, 30], look: [-4, 9, -28] },  // 4 completed reveal
      { p: 0.55, pos: [8, 12, 20], look: [0, 6, -90] },    // 5 road extension / descend
      { p: 0.64, pos: [3, 17, -34], look: [1, 11, -118] }, // 6 enter the city
      { p: 0.74, pos: [-7, 19, -104], look: [4, 12, -150] },// 7 flythrough — through the city, past hubs
      { p: 0.82, pos: [7, 20, -168], look: [-3, 11, -212] },// 8 flythrough — deeper
      { p: 0.88, pos: [-12, 30, -110], look: [5, 12, -150] },// bank + rise
      { p: 0.94, pos: [34, 54, -12], look: [-4, 10, -66] }, // crane over the bridge
      { p: 1.00, pos: [42, 22, 48], look: [-6, 11, -22] },  // 8 hero lock
      { p: 1.12, pos: [24, 21, 43], look: [-4, 9, -26] },   // scroll tail
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
    let lx = L(a.look[0], b.look[0]), ly = L(a.look[1], b.look[1]), lz = L(a.look[2], b.look[2]);
    // gentle idle drift once locked
    if (p >= 0.985 && !this.reducedMotion) {
      const s = smooth((p - 0.985) / 0.015);
      px += Math.sin(this.time * 0.3) * 1.0 * s;
      py += Math.cos(this.time * 0.24) * 0.5 * s;
    }
    // scroll parallax (subtle camera response after the intro)
    if (this._scroll > 0) {
      px += this._scroll * 4;
      py += this._scroll * 6;
      lz -= this._scroll * 6;
    }
    this.camera.position.set(px, py, pz);
    this.camera.lookAt(lx, ly, lz);
  }

  /* ---------- page fly-over (after the intro) ----------
     Scroll drives a calm, high crane that keeps the bridge AND the
     network in frame while the content sections read over it. */
  enterPage() { this._pageActive = true; this.setProgress(1); }
  setPage(t) { this._page = clamp(t, 0, 1); }

  get _pageShots() {
    return [
      { p: 0.00, pos: [42, 22, 48], look: [-6, 11, -22] },   // hero lock
      { p: 0.14, pos: [47, 27, 55], look: [-6, 10, -32] },   // ease back
      { p: 0.42, pos: [56, 46, 66], look: [-8, 6, -66] },    // rise, wider — bridge + city
      { p: 0.72, pos: [30, 74, 70], look: [-6, 3, -104] },   // high overview, network reads
      { p: 1.00, pos: [4, 96, 104], look: [-4, 1, -150] },   // distant, calm drift over the world
    ];
  }

  _applyPage(t) {
    const shots = this._pageShots;
    let i = 0;
    while (i < shots.length - 1 && t > shots[i + 1].p) i++;
    const a = shots[i], b = shots[Math.min(i + 1, shots.length - 1)];
    const k = smooth((t - a.p) / ((b.p - a.p) || 1));
    const L = (u, v2) => u + (v2 - u) * k;
    const bob = this.reducedMotion ? 0 : 1;
    this.camera.position.set(
      L(a.pos[0], b.pos[0]) + Math.sin(this.time * 0.25) * 1.2 * bob,
      L(a.pos[1], b.pos[1]) + Math.cos(this.time * 0.2) * 0.7 * bob,
      L(a.pos[2], b.pos[2])
    );
    this.camera.lookAt(L(a.look[0], b.look[0]), L(a.look[1], b.look[1]), L(a.look[2], b.look[2]));
  }

  /* ==================================================
     STATE — everything as a function of progress
     ================================================== */
  setProgress(p) {
    this.progress = clamp(p, 0, 1.12);
    const P = this.progress;

    for (const part of this.parts) {
      const active = P >= part.t0 - 0.0006;
      part.mesh.visible = active;               // hidden until it flies in
      if (!active) continue;
      const lt = easeInOut((P - part.t0) / (part.t1 - part.t0));
      part.mesh.position.lerpVectors(part.fromPos, part.toPos, lt);
      part.mesh.quaternion.slerpQuaternions(part.fromQuat, part.toQuat, lt);
    }

    const roadRev = win(P, 0.46, 0.58);
    for (const m of this.roadMats) m.opacity = roadRev * 0.95;

    this._cityReveal = win(P, 0.55, 0.78);
    this._updateCity(this._cityReveal);

    this._netReveal = win(P, 0.74, 0.92);
    const nr = this._netReveal;
    if (this.edgeMat) this.edgeMat.opacity = nr * 0.9;
    if (this.nodeMat) this.nodeMat.opacity = nr;
    if (this.beacons) this.beacons.forEach((s) => (s.material.opacity = nr * 0.9));

    if (!this._running || this.reducedMotion) this._applyCamera(this.progress);
  }

  _updateCity(reveal) {
    if (!this._buildings || Math.abs(this._cityRevApplied - reveal) < 0.001) return;
    this._cityRevApplied = reveal;
    const d = this._bd;
    this.buildings.forEach((b, i) => {
      const r = smooth((reveal - b.delay) * 3.0);
      const h = Math.max(0.001, b.h * r);
      d.position.set(b.x, h / 2, b.z);
      d.scale.set(b.w, h, b.d);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this._buildings.setMatrixAt(i, d.matrix);
    });
    this._buildings.instanceMatrix.needsUpdate = true;
  }

  /* pinned-hero scroll: camera tail + subtle layered parallax, softer fade */
  setScroll(s) {
    s = clamp(s, 0, 1);
    this._scroll = s;
    this.setProgress(1 + s * 0.12);
    if (this.city) this.city.position.z = s * 16;         // city drifts in depth
    if (this.network) this.network.position.z = s * 26;   // network layer parallax
    if (this.bridge) this.bridge.position.z = s * 5;
    if (this.container) this.container.style.opacity = String(1 - s * 0.6);
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
      this.nodeSprites.forEach((s, i) => { s.material.opacity = base * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.time * 1.6 + i))); });
      for (let i = 0; i < this.pulses.length; i++) {
        const pu = this.pulses[i]; pu.t += pu.sp;
        if (pu.t > 1) { pu.t = 0; pu.e = Math.floor(Math.random() * this.netEdges.length); }
        const e2 = this.netEdges[pu.e];
        this.pulseSprites[i].position.lerpVectors(this.netNodes[e2[0]], this.netNodes[e2[1]], pu.t);
        this.pulseSprites[i].material.opacity = base * (0.85 + 0.15 * Math.sin(this.time * 6 + i));
      }
    }

    if (this._visible) {
      if (this.reducedMotion) { /* fixed framing */ }
      else if (this._pageActive) this._applyPage(this._page);
      else this._applyCamera(this.progress);
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

function v(x, y, z) { return new THREE.Vector3(x, y, z); }
function e(x, y, z) { return new THREE.Euler(x, y, z); }
