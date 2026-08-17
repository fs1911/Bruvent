# BRUVENT — Security Audit & Penetration Test

**Date:** 2026-08-17
**Target:** BRUVENT static website (index, impressum, datenschutz, 404)
**Type:** Static site (HTML/CSS/JS) on GitHub Pages, HTTPS-only, no backend.

This document records the hardening applied and the automated audit run against
every page. The audit is reproducible with the Playwright script described at the
end.

## Threat model

A static marketing site has a deliberately small attack surface — there is no
server-side code, no database, and no authenticated sessions to compromise. The
realistic risks are therefore:

| Risk | Mitigation |
|------|------------|
| Cross-site scripting (XSS) via injected/third-party scripts | Strict CSP (`default-src 'self'`), no inline scripts, SRI on vendor libs |
| Third-party data leakage / tracking | First-party only: self-hosted fonts, no CDN, no analytics, no cookies |
| Supply-chain tampering of vendored libraries | Subresource Integrity (SHA-384) on gsap / ScrollTrigger / lenis |
| Clickjacking / UI redress | Frame-buster (headers unavailable on GitHub Pages) |
| Mixed content / protocol downgrade | `upgrade-insecure-requests`, HTTPS-only hosting |
| Referrer / tabnabbing leakage | `referrer: no-referrer`, `rel="noopener noreferrer"` |
| Contact-form abuse (spam) | Honeypot field, input length caps, client-side validation |
| DOM base-tag hijacking | `base-uri 'none'` |

## Controls implemented

- **Content-Security-Policy** (meta) on all pages:
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
  font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none';
  child-src 'none'; worker-src 'self'; manifest-src 'self'; base-uri 'none';
  form-action 'self'; upgrade-insecure-requests`.
  Legal/404 pages use `script-src 'none'` (they need no JS).
- **No `unsafe-inline`** anywhere — all inline scripts moved to `js/boot-extra.js`
  and all inline `style=""` attributes converted to CSS classes. GSAP/Three
  animate through the CSSOM (`element.style`), which CSP permits, so the scene
  runs unaffected.
- **Self-hosted fonts** — Google Fonts removed; woff2 served from `/assets/fonts`.
- **SRI** on all three vendored UMD libraries.
- **Referrer-Policy `no-referrer`**, external links `rel="noopener noreferrer"`.
- **Frame-buster** in `boot-extra.js` (GitHub Pages cannot send
  `X-Frame-Options`/`frame-ancestors`).
- **Contact form**: honeypot (`website` field), `maxlength` caps, `mailto:`
  fallback so no data is transmitted to any server.
- **RFC 9116 `security.txt`**, `SECURITY.md`, `robots.txt`, `sitemap.xml`, custom
  `404.html`, `.nojekyll`.

## Automated audit — results

Each page was loaded in headless Chromium; all network requests, console errors,
JS exceptions, and `securitypolicyviolation` events were captured.

| Page | External requests | CSP violations | JS errors | Inline `<script>` | `on*` handlers | CSP meta | WebGL |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| index.html | **0** | **0** | **0** | 0 | 0 | ✓ | ✓ runs |
| impressum.html | **0** | **0** | **0** | 0 | 0 | ✓ | — |
| datenschutz.html | **0** | **0** | **0** | 0 | 0 | ✓ | — |
| 404.html | **0** | **0** | **0** | 0 | 0 | ✓ | — |

Additional checks:

- **Static inline styles in source HTML:** 0 across all pages.
- **Secret scan** (api keys / tokens / private keys / AWS / `ghp_`): none found.
- **Self-hosted fonts:** `document.fonts` reports 7 faces, `status = loaded`;
  the display headline uses the local Archivo variable font.
- **Result:** the strict CSP does **not** break the GSAP + Three.js experience —
  the WebGL canvas renders and animates with zero policy violations.

## Residual items (require infrastructure outside GitHub Pages)

GitHub Pages cannot emit arbitrary HTTP response headers. These header-based
controls are **prepared and ready to deploy** via Cloudflare — see
[`../cloudflare/SETUP.md`](../cloudflare/SETUP.md) (three paths: Cloudflare Pages
`_headers`, Transform Rules, or a Worker). They add:

- `Strict-Transport-Security` (HSTS, includeSubDomains, preload)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` (the `<meta>` form
  ignores `frame-ancestors`; the JS frame-buster covers it until the header ships)
- `Permissions-Policy` (all powerful features denied)
- `Cross-Origin-Opener-Policy` / `-Resource-Policy`, `X-Permitted-Cross-Domain-Policies`

The exact header values live in [`../_headers`](../_headers) and
[`../cloudflare/worker.js`](../cloudflare/worker.js). After DNS is pointed at the
custom domain, verify externally with <https://securityheaders.com> and
<https://observatory.mozilla.org> (target A/A+).

## Reproduce

Serve the folder (`python3 -m http.server`) and run the Playwright audit that
loads each page, records every request/console/`securitypolicyviolation`, and
asserts: external requests = 0, CSP violations = 0, JS errors = 0.
