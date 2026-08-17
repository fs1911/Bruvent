/* ============================================================
   Boot helpers kept out of the HTML so the page can run under a
   strict Content-Security-Policy (script-src 'self', no inline).
   Loaded as a classic script AFTER the vendored libraries and
   BEFORE the main.js module.
   ============================================================ */

/* clickjacking guard: GitHub Pages cannot send X-Frame-Options /
   frame-ancestors headers, so break out of any framing attempt. */
try {
  if (window.top !== window.self) {
    window.top.location = window.self.location;
  }
} catch (e) {
  // cross-origin framer blocked access → hide the body as a fallback
  document.documentElement.style.display = 'none';
}

/* register the ScrollTrigger plugin once GSAP is present */
if (window.gsap && window.ScrollTrigger) {
  window.gsap.registerPlugin(window.ScrollTrigger);
}

/* watchdog: if the module or Three.js fails to load, still reveal
   the (fully readable) static site after a short grace period. */
window.__bruventBooted = window.__bruventBooted || false;
setTimeout(function () {
  if (window.__bruventBooted) return;
  document.body.classList.add('no-webgl');
  document.documentElement.classList.remove('no-js');
  var pre = document.getElementById('preloader');
  if (pre) { pre.classList.add('hidden'); }
  document.body.classList.remove('is-loading');
  var t = document.getElementById('intro-titles'); if (t) { t.style.display = 'none'; }
  var s = document.querySelector('.skip-intro'); if (s) { s.classList.add('gone'); }
  document.querySelectorAll('.nav').forEach(function (n) { n.style.transform = 'none'; });
  document.querySelectorAll('.reveal').forEach(function (r) { r.style.opacity = 1; r.style.transform = 'none'; });
}, 6000);
