# BRUVENT — Cinematic Brand Experience

A cinematic, single-page brand experience for **BRUVENT** — a Swiss consultancy
that *builds bridges between real-world management systems and artificial
intelligence* (quality, environment, safety, integrated management systems,
digitalisation & AI).

The site opens like the first minute of a brand film: a bridge assembles itself
out of the dark, its roadway runs on into an abstracted 3D infrastructure /
network landscape, that network activates, and a controlled drone flythrough
settles seamlessly into the hero. From there it becomes a fast, accessible,
responsive landing page.

There is **no build step** — open `index.html` (via any static server) and it runs.

---

## Tech stack

| Concern              | Choice                                             |
|----------------------|----------------------------------------------------|
| 3D scene / camera    | **Three.js** (`js/vendor/three.module.min.js`, ESM)|
| Timelines            | **GSAP** (UMD global)                              |
| Scroll sequencing    | **GSAP ScrollTrigger** (UMD global)               |
| Smooth scroll        | **Lenis** (UMD global)                            |
| Markup / styling     | Semantic HTML + a single CSS file (custom props)  |

All libraries are **vendored** under `js/vendor/` — no CDN/runtime network
dependency, so the experience is self-contained and deploys anywhere static.

## File structure

```
index.html            DOM shell — fully readable content (progressive enhancement)
css/style.css         Art direction, layout, responsive + reduced-motion rules
js/
  main.js             Bootstrap: preloader → experience → intro timeline →
                      Lenis + ScrollTrigger → UI (nav, form). Fallbacks.
  experience.js       The Three.js scene as a shot system (default export class)
  vendor/             three.module.min.js, gsap.min.js, ScrollTrigger.min.js, lenis.min.js
assets/favicon.svg    Bridge/network brand mark
```

## The one idea that makes it tractable: `progress`

The whole 3D experience is a **pure function of one master value, `progress`**.

- `progress ∈ [0 .. 1]` → the cinematic intro (autoplayed by a GSAP timeline)
- `progress ∈ [1 .. 1.12]` → the pinned-hero scroll scrub (ScrollTrigger)

Bridge construction, world rise, network activation and the camera are **all**
derived from `progress` inside `Experience.setProgress(p)`. That makes the
sequence deterministic, fully reversible (scrub it backwards and it un-builds),
and trivial to drive from either an autoplay timeline or the scrollbar.

## Shot system (camera as shot design)

`experience.js` defines the intro as film-style shots — an array of camera
keyframes `{ p, pos, look }` interpolated with smoothstep:

| p range      | Shot            | What happens                                        |
|--------------|-----------------|-----------------------------------------------------|
| 0.00 – 0.15  | Establishing    | Low, close, in the dark by a pier; fog + dust       |
| 0.15 – 0.40  | Construction    | Piers → deck segments settle in → towers rise → cables tension in |
| 0.40 – 0.56  | Tracking        | Camera drops onto the road axis, looks down the deck |
| 0.56 – 0.70  | Transformation  | Road meets terrain; the topographic grid + city blocks rise |
| 0.70 – 0.88  | Aerial drone    | Wide, slow orbit; the network nodes/edges activate, pulses travel |
| 0.88 – 1.00  | Lock            | Stabilises into the 3/4 hero framing (bridge + city beyond) |

The bridge is built from real parts (piers, deck segments, A-frame pylons,
fanned stay-cables) with concrete/metal `MeshStandardMaterial`s — not a wireframe
— and each part carries a `[t0,t1]` construction window so it assembles in a
logical order. Glow (nodes, pulses, beacons) is done with additive sprite
textures + emissive materials rather than post-processing, which keeps it fast
and dependency-free.

## Scroll dramaturgy

1. **Stage 1 — pinned hero.** `.hero__grid` is pinned for ~1.1 viewports;
   scroll scrubs the camera tail (`progress 1 → 1.12`, a slow push-in) and fades
   the scene + hero text. Rendering is suspended once the scene scrolls away.
2. **Stage 2 — story content.** System / Prozess / Use Cases / Vertrauen reveal
   with staggered ScrollTrigger animations over solid, layered backgrounds.
3. **Stage 3 — finale CTA + contact**, reprising the bridge/network motif.

## Performance, accessibility, responsive

- **Tiers** (`detectTier()`): `high | mid | low` scale DPR cap, geometry counts
  (city blocks, network nodes, dust) and antialiasing. Mobile → `low`.
- **`prefers-reduced-motion`**: no autoplay, no camera motion, no smooth-scroll;
  the scene is rendered once in its composed *lock* framing and the hero is shown
  immediately. All CSS animations are neutralised.
- **Progressive enhancement**: every section is real, static, accessible HTML.
  If WebGL is unavailable or the module fails to load, a watchdog reveals the
  full site over a static gradient hero — nothing is JS-gated.
- Rendering pauses on tab blur and once the hero is scrolled past (battery).

## Run locally

```bash
# any static server works, e.g.
python3 -m http.server 8099
# then open http://127.0.0.1:8099
```

## Content / art direction

Ported from the BRUVENT Claude Design project: midnight-navy / graphite base
with a single controlled cyan accent (`#4CE3E0`), Archivo display + IBM Plex
Sans/Mono. German (Swiss) copy, B2B tone.
