/* ============================================================
   BRIDGENT — 3D Experience
   A single Three.js scene driven by ONE master value: progress.

   progress ∈ [0 .. 1]  → the cinematic intro (autoplayed by GSAP)
   progress ∈ [1 .. 1.12] → the pinned-hero scroll scrub

   The scene is authored as a shot system. Each "shot" is a camera
   keyframe (position + look-at). Bridge construction, world rise and
   network activation are all functions of progress, so the whole
   experience is deterministic and fully reversible.
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';

/* ---------- palette (linear-friendly hex) ---------- */
const COL = {
  bg:       0x03060e,
  concrete: 0x2a3442,
  concrete2:0x1c2530,
  metal:    0x5a6b7c,
  metalHi:  0x8ba0b3,
  deck:     0x141c28,
  accent:   0x4ce3e0,
  accentB:  0x8ff4ee,
  blue:     0x2c90cf,
  navy:     0x0a1c38,
};

/* smoothstep + helpers */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
// map x from [a,b] → [0,1] then smoothstep
const win = (x, a, b) => smooth((x - a) / (b - a));

/* radial sprite texture for glows / pulses (built once) */
function makeGlowTexture() {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(180,250,246,0.85)');
  grd.addColorStop(0.55, 'rgba(76,227,224,0.35)');
  grd.addColorStop(1.0, 'rgba(76,227,224,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default class Experience {
  constructor(container, opts = {}) {
    this.container = container;
    this.tier = opts.tier || 'high';        // 'high' | 'mid' | 'low'
    this.reducedMotion = !!opts.reducedMotion;
    this.progress = 0;
    this.time = 0;
    this.canvasFade = 1;                      // multiplied into overall opacity
    this._running = true;
    this._visible = true;

    this._initRenderer();
    this._initScene();
    this._buildBridge();
    this._buildWorld();
    this._buildNetwork();

    this._glow = makeGlowTexture();
    this._decorateGlows();

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
    const dprCap = this.tier === 'low' ? 1.35 : this.tier === 'mid' ? 1.75 : 2;
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.tier !== 'low',
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
  }

  /* -------------------------------------------------- scene / camera / light */
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(COL.bg, 0.0055);

    this.camera = new THREE.PerspectiveCamera(
      42, this.container.clientWidth / this.container.clientHeight, 0.5, 900
    );
    this.camera.position.set(14, 3, 40);

    // cool ambient fill
    const hemi = new THREE.HemisphereLight(0x22406e, 0x02040a, 0.55);
    this.scene.add(hemi);

    // cinematic key light (raking, cool)
    const key = new THREE.DirectionalLight(0xbcd6ff, 1.35);
    key.position.set(-40, 60, 30);
    this.scene.add(key);

    // warm-ish rim from the far city to separate silhouettes
    const rim = new THREE.DirectionalLight(0x1a5f6b, 0.8);
    rim.position.set(30, 18, -120);
    this.scene.add(rim);

    // accent point lights near the towers (glow pools)
    this.towerLights = [];
    for (const z of [-10, -45]) {
      const p = new THREE.PointLight(COL.accent, 0, 90, 2);
      p.position.set(0, 30, z);
      this.scene.add(p);
      this.towerLights.push(p);
    }

    // subtle starfield / dust for depth
    this._buildDust();
  }

  _buildDust() {
    const n = this.tier === 'low' ? 240 : 520;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 380;
      pos[i * 3 + 1] = Math.random() * 120 - 6;
      pos[i * 3 + 2] = -Math.random() * 300 + 40;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0x9fd6e6, size: 0.6, sizeAttenuation: true,
      transparent: true, opacity: 0.35, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dust = new THREE.Points(g, m);
    this.scene.add(this.dust);
  }

  /* -------------------------------------------------- BRIDGE
     A cable-stayed bridge running along -Z. Every part records a
     [start,end] construction window so it assembles segment by segment. */
  _buildBridge() {
    this.bridge = new THREE.Group();
    this.scene.add(this.bridge);
    this.buildParts = [];

    const deckY = 7, deckW = 9, deckH = 1.1;
    const zNear = 34, zFar = -78, span = zNear - zFar; // 112
    const segN = this.tier === 'low' ? 12 : 18;

    const concrete = new THREE.MeshStandardMaterial({ color: COL.concrete, roughness: 0.92, metalness: 0.08 });
    const metal = new THREE.MeshStandardMaterial({ color: COL.metal, roughness: 0.38, metalness: 0.85 });
    const deckMat = new THREE.MeshStandardMaterial({ color: COL.deck, roughness: 0.7, metalness: 0.35 });
    const lineMat = new THREE.MeshStandardMaterial({
      color: COL.accent, emissive: COL.accent, emissiveIntensity: 1.4, roughness: 0.5, metalness: 0,
    });
    this._deckLineMat = lineMat;
    const cableMat = new THREE.MeshStandardMaterial({
      color: COL.metalHi, emissive: COL.blue, emissiveIntensity: 0.25, roughness: 0.5, metalness: 0.6,
    });

    // --- piers (grow up from ground) ---
    const pierZs = [zNear - 6, 22, -10, -45, zFar + 8];
    pierZs.forEach((z, i) => {
      const t0 = 0.02 + i * 0.012;
      const grp = this._growGroup(0, 0, z, t0, t0 + 0.12, 'pier');
      const h = deckY;
      const pier = new THREE.Mesh(new THREE.BoxGeometry(3.4, h, 3.4), concrete);
      pier.position.y = h / 2;
      grp.add(pier);
      // crossbeam cap
      const cap = new THREE.Mesh(new THREE.BoxGeometry(deckW + 2, 0.9, 4), concrete);
      cap.position.y = h - 0.2;
      grp.add(cap);
    });

    // --- deck segments (settle into place, near → far) ---
    const segLen = span / segN;
    this.deckSegments = [];
    for (let i = 0; i < segN; i++) {
      const z = zNear - segLen * (i + 0.5);
      const t0 = 0.16 + (i / segN) * 0.34;      // 0.16 → 0.50
      const grp = new THREE.Group();
      grp.position.set(0, deckY, z);
      this.bridge.add(grp);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, deckH, segLen * 0.96), deckMat);
      grp.add(deck);
      // side rails (metal)
      for (const sx of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, segLen * 0.96), metal);
        rail.position.set(sx * (deckW / 2 - 0.2), 0.75, 0);
        grp.add(rail);
      }
      // glowing centre lane marking
      const lane = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, segLen * 0.6), lineMat);
      lane.position.y = deckH / 2 + 0.03;
      grp.add(lane);

      this.buildParts.push({ obj: grp, t0, t1: t0 + 0.14, kind: 'deck', baseY: deckY });
      this.deckSegments.push(grp);
    }

    // --- towers / pylons (rise) ---
    const towerData = [{ z: -10, h: 30 }, { z: -45, h: 26 }];
    this.towers = [];
    towerData.forEach((td, i) => {
      const t0 = 0.24 + i * 0.05;
      const grp = this._growGroup(0, 0, td.z, t0, t0 + 0.14, 'tower');
      // A-frame: two legs + crossbar
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.5, td.h, 1.5), metal);
        leg.position.set(sx * (deckW / 2 + 0.4), td.h / 2, 0);
        leg.rotation.z = sx * 0.09;
        grp.add(leg);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(deckW + 3, 1.4, 1.6), metal);
      bar.position.y = td.h * 0.62;
      grp.add(bar);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16),
        new THREE.MeshStandardMaterial({ color: COL.accentB, emissive: COL.accent, emissiveIntensity: 2 }));
      beacon.position.y = td.h + 0.4;
      grp.add(beacon);
      this.towers.push({ grp, top: td.h, z: td.z });
    });

    // --- cables (fade + tension in) fanning tower→deck ---
    this.cableGroup = new THREE.Group();
    this.bridge.add(this.cableGroup);
    this._cableMats = [];
    towerData.forEach((td) => {
      const nCables = this.tier === 'low' ? 4 : 6;
      for (let s = 1; s <= nCables; s++) {
        for (const dir of [-1, 1]) {
          const deckZ = td.z + dir * s * (span / 26);
          for (const sx of [-1, 1]) {
            const top = new THREE.Vector3(sx * (deckW / 2 + 0.4), td.h * 0.9, td.z);
            const bot = new THREE.Vector3(sx * (deckW / 2 - 0.3), deckY + 0.6, deckZ);
            const cyl = this._segment(top, bot, 0.07, cableMat.clone());
            cyl.material.transparent = true;
            cyl.material.opacity = 0;
            this._cableMats.push(cyl.material);
            const t0 = 0.42 + Math.random() * 0.12;
            this.buildParts.push({ obj: cyl, t0, t1: t0 + 0.14, kind: 'cable' });
            this.cableGroup.add(cyl);
          }
        }
      }
    });

    this._bridgeGeom = { deckY, zNear, zFar, deckW };
  }

  // group that grows upward (scale.y) from the ground within a window
  _growGroup(x, y, z, t0, t1, kind) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    this.bridge.add(g);
    this.buildParts.push({ obj: g, t0, t1, kind });
    return g;
  }

  // oriented cylinder between two points
  _segment(a, b, r, mat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(r, r, len, 6, 1, true);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  }

  /* -------------------------------------------------- WORLD
     Beyond the bridge: a topographic grid + an abstracted city of
     instanced blocks that rise during the transformation shot, plus
     glowing road-paths branching from the bridge axis. */
  _buildWorld() {
    this.world = new THREE.Group();
    this.scene.add(this.world);

    const { zFar } = this._bridgeGeom;

    // topographic ground grid
    const grid = new THREE.GridHelper(360, 72, COL.accent, 0x0e2a3a);
    grid.material.transparent = true;
    grid.material.opacity = 0;
    grid.position.set(0, 0.02, -140);
    this._grid = grid;
    this.world.add(grid);

    // dark ground plane (so blocks read as silhouettes over fog)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x05090f, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -150);
    this.world.add(ground);

    // --- instanced city blocks ---
    const count = this.tier === 'low' ? 90 : this.tier === 'mid' ? 150 : 210;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x101c2b, roughness: 0.55, metalness: 0.55 });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const emissiveCol = new THREE.Color(COL.accent);
    const baseCol = new THREE.Color(0x0d1826);
    const dummy = new THREE.Object3D();
    this._cityData = [];
    let placed = 0;
    const areaX = 150, zStart = zFar - 14, zEnd = -230;
    let guard = 0;
    while (placed < count && guard++ < count * 6) {
      const gx = Math.round((Math.random() - 0.5) * areaX / 6) * 6;
      const gz = zStart - Math.random() * (zStart - zEnd);
      // leave a corridor for the main road near x≈0
      if (Math.abs(gx) < 5 && gz > zEnd + 30) continue;
      const w = 2 + Math.random() * 4;
      const d = 2 + Math.random() * 4;
      const h = 3 + Math.pow(Math.random(), 1.6) * 40;
      const hot = Math.random() < 0.28;
      this._cityData.push({ x: gx + (Math.random() - 0.5) * 4, z: gz, w, d, h, hot });
      inst.setColorAt(placed, hot ? emissiveCol.clone().multiplyScalar(0.5) : baseCol);
      placed++;
    }
    inst.count = placed;
    inst.instanceColor.needsUpdate = true;
    this._city = inst;
    this._cityDummy = dummy;
    this.world.add(inst);
    this._cityMat = mat;

    // --- glowing road paths branching from the bridge axis ---
    this.paths = [];
    const pathMat = new THREE.MeshStandardMaterial({
      color: COL.accent, emissive: COL.accent, emissiveIntensity: 1.2,
      transparent: true, opacity: 0, roughness: 0.6, metalness: 0,
    });
    this._pathMat = pathMat;
    const branchDefs = [
      [[0, zFar], [0, -150]],
      [[0, -120], [-60, -200]],
      [[0, -120], [58, -190]],
      [[0, -150], [-30, -228]],
      [[0, -150], [34, -226]],
    ];
    for (const [[x0, z0], [x1, z1]] of branchDefs) {
      const a = new THREE.Vector3(x0, 0.06, z0);
      const b = new THREE.Vector3(x1, 0.06, z1);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, len), pathMat);
      strip.position.copy(a).addScaledVector(dir, 0.5);
      strip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
      this.world.add(strip);
      this.paths.push({ a, b, len });
    }
  }

  /* -------------------------------------------------- NETWORK
     Nodes hovering above the city, nearest-neighbour edges, and
     light pulses that travel the edges once activated. */
  _buildNetwork() {
    this.network = new THREE.Group();
    this.scene.add(this.network);

    const N = this.tier === 'low' ? 22 : this.tier === 'mid' ? 34 : 46;
    const nodes = [];
    for (let i = 0; i < N; i++) {
      nodes.push(new THREE.Vector3(
        (Math.random() - 0.5) * 150,
        8 + Math.random() * 26,
        -90 - Math.random() * 150
      ));
    }
    this.netNodes = nodes;

    // edges: connect each node to its 2 nearest neighbours
    const edgeSet = new Set();
    const edges = [];
    for (let a = 0; a < N; a++) {
      const ds = [];
      for (let b = 0; b < N; b++) if (a !== b) ds.push([nodes[a].distanceToSquared(nodes[b]), b]);
      ds.sort((p, q) => p[0] - q[0]);
      const k = 2 + (Math.random() < 0.4 ? 1 : 0);
      for (let n = 0; n < k; n++) {
        const b = ds[n][1];
        if (ds[n][0] > 90 * 90) continue;
        const key = a < b ? a + '_' + b : b + '_' + a;
        if (!edgeSet.has(key)) { edgeSet.add(key); edges.push([Math.min(a, b), Math.max(a, b)]); }
      }
    }
    this.netEdges = edges;

    // edge line segments
    const lpos = new Float32Array(edges.length * 6);
    edges.forEach((e, i) => {
      nodes[e[0]].toArray(lpos, i * 6);
      nodes[e[1]].toArray(lpos, i * 6 + 3);
    });
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    this._edgeMat = new THREE.LineBasicMaterial({
      color: COL.accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.network.add(new THREE.LineSegments(lgeo, this._edgeMat));

    // node cores
    const coreGeo = new THREE.SphereGeometry(0.5, 10, 10);
    this._nodeMat = new THREE.MeshBasicMaterial({ color: COL.accentB, transparent: true, opacity: 0 });
    const cores = new THREE.InstancedMesh(coreGeo, this._nodeMat, N);
    const d = new THREE.Object3D();
    nodes.forEach((p, i) => { d.position.copy(p); d.updateMatrix(); cores.setMatrixAt(i, d.matrix); });
    cores.instanceMatrix.needsUpdate = true;
    this.network.add(cores);
    this._cores = cores;
    this._coreDummy = d;

    // travelling pulses
    this.pulses = [];
    const nP = this.tier === 'low' ? 8 : 16;
    for (let i = 0; i < nP; i++) {
      this.pulses.push({ e: Math.floor(Math.random() * edges.length), t: Math.random(), sp: 0.004 + Math.random() * 0.01 });
    }
  }

  /* -------------------------------------------------- glow sprites */
  _decorateGlows() {
    // node glow sprites (additive)
    this._nodeSprites = [];
    const N = this.netNodes.length;
    const glowMat = new THREE.SpriteMaterial({ map: this._glow, color: COL.accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this._nodeGlowMat = glowMat;
    for (let i = 0; i < N; i++) {
      const sp = new THREE.Sprite(glowMat);
      sp.position.copy(this.netNodes[i]);
      sp.scale.setScalar(6);
      this.network.add(sp);
      this._nodeSprites.push(sp);
    }
    // pulse sprites
    this._pulseSprites = this.pulses.map(() => {
      const m = new THREE.SpriteMaterial({ map: this._glow, color: COL.accentB, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const sp = new THREE.Sprite(m);
      sp.scale.setScalar(4);
      this.network.add(sp);
      return sp;
    });
    // tower beacon glows
    this._towerGlow = this.towers.map((tw) => {
      const m = new THREE.SpriteMaterial({ map: this._glow, color: COL.accent, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
      const sp = new THREE.Sprite(m);
      sp.position.set(0, tw.top + 0.4, tw.z);
      sp.scale.setScalar(5);
      tw.grp.add(sp);
      return sp;
    });
  }

  /* ==================================================
     CAMERA — the shot system.
     Each keyframe: { p, pos:[x,y,z], look:[x,y,z] }.
     ================================================== */
  get _shots() {
    return [
      // 1 — Establishing: low, close, in the dark by a pier
      { p: 0.00, pos: [15, 3.2, 42], look: [0, 6, 12] },
      // 2 — Construction: crane up, side-on as the bridge assembles
      { p: 0.18, pos: [30, 11, 34], look: [-2, 10, -4] },
      { p: 0.34, pos: [34, 22, 16], look: [-6, 10, -34] },
      // 3 — Tracking: drop onto the axis, look down the roadway
      { p: 0.46, pos: [2.5, 11, 30], look: [0, 8, -62] },
      { p: 0.56, pos: [0, 13, -8], look: [0, 7, -86] },
      // 4 — Transformation: lift as the road meets the terrain/city
      { p: 0.66, pos: [0, 34, -46], look: [0, 5, -136] },
      // 5 — Aerial drone: wide, slow orbit across the network
      { p: 0.78, pos: [52, 66, -74], look: [-8, 6, -150] },
      { p: 0.88, pos: [-34, 58, -46], look: [2, 8, -140] },
      // 6 — Lock: stabilise into hero framing (bridge + city beyond)
      { p: 1.00, pos: [40, 28, 48], look: [-6, 10, -26] },
      // scroll scrub tail — a gentle push-in
      { p: 1.12, pos: [20, 22, 40], look: [-4, 9, -30] },
    ];
  }

  _applyCamera(p) {
    const shots = this._shots;
    let i = 0;
    while (i < shots.length - 1 && p > shots[i + 1].p) i++;
    const a = shots[i], b = shots[Math.min(i + 1, shots.length - 1)];
    const span = (b.p - a.p) || 1;
    const t = smooth((p - a.p) / span);
    const lerp = (u, v) => u + (v - u) * t;

    let px = lerp(a.pos[0], b.pos[0]);
    let py = lerp(a.pos[1], b.pos[1]);
    let pz = lerp(a.pos[2], b.pos[2]);
    const lx = lerp(a.look[0], b.look[0]);
    const ly = lerp(a.look[1], b.look[1]);
    const lz = lerp(a.look[2], b.look[2]);

    // gentle idle drift once locked (adds life to the hero)
    if (p >= 0.985 && !this.reducedMotion) {
      const s = smooth((p - 0.985) / 0.015);
      px += Math.sin(this.time * 0.35) * 1.1 * s;
      py += Math.cos(this.time * 0.28) * 0.6 * s;
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

    // --- bridge construction ---
    for (const part of this.buildParts) {
      const k = win(P, part.t0, part.t1);
      const o = part.obj;
      if (part.kind === 'deck') {
        o.scale.y = 0.25 + 0.75 * k;
        o.position.y = part.baseY + (1 - k) * 9;
        o.traverse((c) => { if (c.material) { c.material.transparent = true; c.material.opacity = k; } });
      } else if (part.kind === 'tower' || part.kind === 'pier') {
        o.scale.y = Math.max(0.001, k);
      } else if (part.kind === 'cable') {
        if (o.material) o.material.opacity = k * 0.9;
      }
    }
    // deck lane markings brighten as the bridge nears completion
    if (this._deckLineMat) this._deckLineMat.emissiveIntensity = 0.6 + 1.6 * win(P, 0.4, 0.62);

    // tower accent lights / beacons ramp in
    const towerGlow = win(P, 0.3, 0.5);
    this.towerLights.forEach((l) => (l.intensity = towerGlow * 1.4));
    if (this._towerGlow) this._towerGlow.forEach((s) => (s.material.opacity = 0.2 + 0.7 * towerGlow));

    // --- world rise (transformation) ---
    this._worldReveal = win(P, 0.52, 0.72);
    if (this._grid) this._grid.material.opacity = this._worldReveal * 0.5;
    if (this._pathMat) this._pathMat.opacity = win(P, 0.58, 0.78) * 0.9;
    this._updateCity(this._worldReveal);

    // --- network activation ---
    this._netReveal = win(P, 0.64, 0.86);
    const nr = this._netReveal;
    if (this._edgeMat) this._edgeMat.opacity = nr * 0.45;
    if (this._nodeMat) this._nodeMat.opacity = nr;
    if (this._nodeGlowMat) this._nodeGlowMat.opacity = nr * 0.8;

    // dust fades slightly as we leave the dark opening
    if (this.dust) this.dust.material.opacity = 0.35 * (1 - win(P, 0.6, 1.0) * 0.5);

    if (!this._running || this.reducedMotion) this._applyCamera(this.progress);
  }

  _updateCity(reveal) {
    if (!this._city || this._cityRevealApplied === reveal) return;
    this._cityRevealApplied = reveal;
    const d = this._cityDummy;
    this._cityData.forEach((b, i) => {
      const h = Math.max(0.001, b.h * reveal);
      d.position.set(b.x, h / 2, b.z);
      d.scale.set(b.w, h, b.d);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this._city.setMatrixAt(i, d.matrix);
    });
    this._city.instanceMatrix.needsUpdate = true;
  }

  /* scroll scrub (pinned hero): s ∈ [0,1] → progress 1 .. 1.12 + fade */
  setScroll(s) {
    s = clamp(s, 0, 1);
    this.setProgress(1 + s * 0.12);
    this.canvasFade = 1 - s * 0.85;
    if (this.container) this.container.style.opacity = String(this.canvasFade);
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

    // animated bits (only meaningful once activated)
    if (!this.reducedMotion) {
      if (this.dust) this.dust.rotation.y += dt * 0.008;
      // node twinkle
      if (this._netReveal > 0.01 && this._nodeGlowMat) {
        const base = this._netReveal * 0.8;
        this._nodeSprites.forEach((sp, i) => {
          const tw = 0.75 + 0.25 * Math.sin(this.time * 1.6 + i);
          sp.scale.setScalar((5 + Math.sin(this.time + i) * 1.2) * (0.6 + 0.4 * this._netReveal));
          sp.material.opacity = base * tw;
        });
        // pulses travel edges
        for (let i = 0; i < this.pulses.length; i++) {
          const pu = this.pulses[i];
          pu.t += pu.sp;
          if (pu.t > 1) { pu.t = 0; pu.e = Math.floor(Math.random() * this.netEdges.length); }
          const e = this.netEdges[pu.e];
          const A = this.netNodes[e[0]], B = this.netNodes[e[1]];
          const sp = this._pulseSprites[i];
          sp.position.lerpVectors(A, B, pu.t);
          sp.material.opacity = this._netReveal;
        }
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
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}
