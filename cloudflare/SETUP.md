# Cloudflare — Security Headers Setup

GitHub Pages cannot send real HTTP response headers (HSTS,
`X-Content-Type-Options`, a header-based CSP with `frame-ancestors`,
`Permissions-Policy`, …). Putting Cloudflare in front of `bruvent.com` fixes
this. Pick **one** of the three paths below. The header set is already prepared
in this repo:

- **`_headers`** (repo root) — for Cloudflare **Pages**.
- **`cloudflare/worker.js`** — for a Cloudflare **Worker** in front of GitHub Pages.
- The **Transform Rules** table below — no-code, for proxied DNS.

All three deliver the identical header set. After any of them, verify at
<https://securityheaders.com> and <https://observatory.mozilla.org> — target
grade **A/A+**.

---

## Option A — Cloudflare Pages (recommended)

Moves hosting from GitHub Pages to Cloudflare Pages (still built from this Git
repo). The `_headers` file then works natively, hosting is free and fast, and
you no longer need the GitHub Actions deploy.

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → select `fs1911/Bruvent`.
2. Build settings: **Framework preset = None**, **Build command = (leave empty)**,
   **Build output directory = `/`** (the site is static, no build step).
3. Deploy. Then **Custom domains** → add `bruvent.com` (and `www`). Cloudflare
   sets the DNS automatically if the zone is on Cloudflare.
4. Done — `_headers` is applied to every response. (You can disable the GitHub
   Pages deployment afterwards to avoid two sources.)

> Note: keep the `CNAME` file for GitHub Pages OR remove it if you fully switch
> to Pages — it does no harm either way.

---

## Option B — Keep GitHub Pages, add Transform Rules (no code)

Keeps GitHub Pages as the origin; Cloudflare only proxies and adds headers.

1. Point DNS at GitHub Pages **through Cloudflare** (orange cloud = Proxied):
   four `A` records for the apex `bruvent.com` →
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`,
   and `www` → `CNAME fs1911.github.io`. Set both to **Proxied**.
2. SSL/TLS → **Overview** → mode **Full (strict)**.
3. SSL/TLS → **Edge Certificates** → enable **Always Use HTTPS** and
   **HTTP Strict Transport Security (HSTS)** (max-age 2 years, includeSubDomains,
   preload). This gives you HSTS without a rule.
4. **Rules → Transform Rules → Modify Response Header → Create rule**.
   "When incoming requests match" = **All incoming requests**. Then **Set static**
   for each header below:

   | Header | Value |
   |--------|-------|
   | `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` |
   | `X-Content-Type-Options` | `nosniff` |
   | `X-Frame-Options` | `DENY` |
   | `Referrer-Policy` | `no-referrer` |
   | `Permissions-Policy` | `accelerometer=(), autoplay=(), browsing-topics=(), camera=(), clipboard-read=(), clipboard-write=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), xr-spatial-tracking=()` |
   | `Cross-Origin-Opener-Policy` | `same-origin` |
   | `Cross-Origin-Resource-Policy` | `same-origin` |
   | `X-Permitted-Cross-Domain-Policies` | `none` |

   (Skip `Strict-Transport-Security` here — step 3 already sets it.)
5. Deploy the rule.

---

## Option C — Keep GitHub Pages, use a Worker

Same origin as Option B, but headers come from `cloudflare/worker.js`.

1. DNS + SSL as in Option B, steps 1–3.
2. Cloudflare Dashboard → **Workers & Pages** → **Create Worker**, paste
   `cloudflare/worker.js`, **Deploy**.
3. The Worker → **Settings → Triggers → Routes** → add `bruvent.com/*` and
   `www.bruvent.com/*`.
4. Done. Edit the header constants in `worker.js` if you ever change the policy
   (keep it in sync with `_headers`).

---

## Notes

- **HSTS `preload`** commits the domain to HTTPS-only in browsers. Only submit to
  <https://hstspreload.org> once you're sure every subdomain will always serve
  HTTPS. `includeSubDomains` is already in the value.
- The in-page `<meta>` CSP stays as a second layer — the header CSP and meta CSP
  are both enforced; they're compatible (the header only *adds* `frame-ancestors`).
- The header set intentionally omits `Cross-Origin-Embedder-Policy: require-corp`
  — it would force CORP/CORS on every subresource and can break WebGL/font loads.
  `COOP: same-origin` alone gives the isolation benefit without that risk.
- **Contact form:** if you later switch the form from `mailto:` to a hosted
  endpoint (e.g. Formspree), add that origin to `connect-src` in **both** the
  `<meta>` CSP (in the HTML) and the header CSP here.
