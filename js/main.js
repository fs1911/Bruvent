/* ============================================================
   BRIDGENT — bootstrap
   Orchestrates: preloader → 3D experience → cinematic intro
   timeline → Lenis smooth scroll + ScrollTrigger → UI.

   Progressive enhancement: the DOM content is fully readable
   without JS/WebGL. Everything below only *adds* motion.
   ============================================================ */

import Experience from './experience.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const Lenis = window.Lenis;

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_MOBILE = window.matchMedia('(max-width: 760px)').matches;

document.documentElement.classList.remove('no-js');

/* ---------- tier detection (perf budget) ---------- */
function detectTier() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (IS_MOBILE || mem <= 3 || cores <= 3) return 'low';
  if (mem <= 6 || cores <= 6) return 'mid';
  return 'high';
}

/* ---------- WebGL support probe ---------- */
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

const state = { exp: null, lenis: null, intro: null, introDone: false };

/* ============================================================
   PRELOADER
   ============================================================ */
const preloader = document.getElementById('preloader');
const preCount = document.querySelector('.pre-count');

function fakeLoad() {
  return new Promise((resolve) => {
    let v = 0;
    const id = setInterval(() => {
      v += Math.random() * 18;
      if (v >= 100) { v = 100; clearInterval(id); setTimeout(resolve, 260); }
      if (preCount) preCount.textContent = String(Math.floor(v)).padStart(3, '0') + '%';
    }, 120);
  });
}

function hidePreloader() {
  if (!preloader) return;
  preloader.classList.add('hidden');
  document.body.classList.remove('is-loading');
}

/* ============================================================
   3D EXPERIENCE + INTRO
   ============================================================ */
function startExperience() {
  const container = document.getElementById('webgl');
  const supported = hasWebGL();

  if (!supported || !window.THREE_OK) {
    // graceful fallback — no canvas, content already visible
    document.body.classList.add('no-webgl');
    revealHeroInstant();
    setupScroll(true);
    return;
  }

  try {
    state.exp = new Experience(container, { tier: detectTier(), reducedMotion: REDUCED });
  } catch (err) {
    console.error('[bridgent] WebGL init failed, using fallback:', err);
    document.body.classList.add('no-webgl');
    revealHeroInstant();
    setupScroll(true);
    return;
  }

  requestAnimationFrame(() => container.classList.add('ready'));

  if (REDUCED) {
    // static, composed hero — no camera motion
    state.exp.setProgress(1);
    revealHeroInstant();
    setupScroll(false);
    return;
  }

  playIntro();
}

/* ---------- cinematic intro timeline ---------- */
function playIntro() {
  const titles = document.getElementById('intro-titles');
  const skip = document.querySelector('.skip-intro');
  const proxy = { p: 0 };

  const finish = () => {
    if (state.introDone) return;
    state.introDone = true;
    if (state.intro) state.intro.kill();
    state.exp.setProgress(1);
    gsap.to(titles, { opacity: 0, duration: 0.5, onComplete: () => titles && titles.classList.add('gone') });
    if (skip) { skip.classList.add('gone'); }
    revealHero();
    setupScroll(false);
  };

  if (skip) skip.addEventListener('click', finish);

  const tl = gsap.timeline({ onComplete: finish });
  state.intro = tl;

  // Drive the master progress through the eight shots. The pacing is
  // deliberate: the mechanical assembly and the flythrough need room to
  // read. Non-linear easing gives the exploded view a calm beat before
  // the assembly, and a gentle settle into the hero lock.
  tl.to(proxy, {
    p: 1, duration: 20.5, ease: 'power1.inOut',
    onUpdate: () => state.exp.setProgress(proxy.p),
  });

  // title cards fade in over the drone flythrough → hero lock
  tl.add(() => { if (titles) titles.classList.add('on'); }, 16.2);
}

/* ============================================================
   HERO REVEAL
   ============================================================ */
function heroRevealEls() {
  return gsap.utils.toArray('[data-hero-reveal]');
}
function revealHero() {
  showNav();
  gsap.to(heroRevealEls(), {
    opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.12,
  });
}
function revealHeroInstant() {
  showNav(true);
  gsap.set(heroRevealEls(), { opacity: 1, y: 0 });
  gsap.set('#intro-titles', { display: 'none' });
  const skip = document.querySelector('.skip-intro');
  if (skip) skip.classList.add('gone');
}
function showNav(instant) {
  gsap.to('.nav', { y: 0, duration: instant ? 0 : 0.8, ease: 'power3.out', delay: instant ? 0 : 0.2 });
}

/* ============================================================
   SMOOTH SCROLL + SCROLLTRIGGER
   ============================================================ */
function setupScroll(noWebgl) {
  // Lenis smooth scroll (skip if reduced motion)
  if (!REDUCED && Lenis) {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 1, lerp: 0.1 });
    state.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add('lenis');
  }

  if (!ScrollTrigger) return;

  // Pinned hero: scrub the camera tail + fade the scene/text out
  if (!noWebgl && state.exp && !REDUCED) {
    const heroText = heroRevealEls();
    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top top',
      end: '+=110%',
      pin: '.hero__grid',
      pinSpacing: true,
      scrub: 0.6,
      onUpdate: (self) => {
        const s = self.progress;
        state.exp.setScroll(s);
        gsap.set(heroText, { opacity: 1 - s * 1.1, y: -s * 40 });
      },
    });
    // stop rendering once the scene is fully scrolled away (battery)
    ScrollTrigger.create({
      trigger: '#system', start: 'top 80%',
      onEnter: () => state.exp && state.exp.setVisible(false),
      onLeaveBack: () => state.exp && state.exp.setVisible(true),
    });
  }

  // Section reveals
  if (!REDUCED) {
    gsap.utils.toArray('[data-reveal]').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 34 }, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });
    // staggered grids
    gsap.utils.toArray('[data-reveal-stagger]').forEach((grid) => {
      gsap.fromTo(grid.children, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.08,
        scrollTrigger: { trigger: grid, start: 'top 82%' },
      });
    });
  } else {
    gsap.set('[data-reveal],[data-reveal-stagger] > *', { opacity: 1, y: 0 });
  }

  ScrollTrigger.refresh();
}

/* ============================================================
   UI — nav anchor scrolling, contact form
   ============================================================ */
function setupUI() {
  // smooth anchor scrolling through Lenis
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (state.lenis) state.lenis.scrollTo(target, { offset: -10, duration: 1.2 });
      else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
    });
  });

  // contact form → success state (no backend; front-end demo)
  const form = document.getElementById('contactForm');
  const sent = document.getElementById('formSent');
  if (form && sent) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      form.style.display = 'none';
      sent.style.display = 'flex';
      gsap.fromTo(sent, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
    });
  }
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  window.__bridgentBooted = true;
  document.body.classList.add('is-loading');
  setupUI();
  await fakeLoad();
  hidePreloader();
  startExperience();
}

// mark that the THREE module resolved (index.html sets a flag on error)
window.THREE_OK = true;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
