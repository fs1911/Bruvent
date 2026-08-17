/**
 * Cloudflare Worker — injects security headers in front of the origin.
 *
 * Use this ONLY if you keep hosting on GitHub Pages and proxy the domain
 * through Cloudflare (orange-cloud DNS). Deploy it and add a route
 * `bruvent.com/*` (and `www.bruvent.com/*`) so every response passes
 * through here. If you host on Cloudflare Pages instead, you don't need
 * this — use the repo's `_headers` file.
 *
 * The header set is identical to `_headers` at the repo root; keep them
 * in sync if you change one.
 */

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; " +
    "child-src 'none'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; " +
    "form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy':
    'accelerometer=(), autoplay=(), browsing-topics=(), camera=(), clipboard-read=(), ' +
    'clipboard-write=(), display-capture=(), encrypted-media=(), fullscreen=(), ' +
    'geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), ' +
    'payment=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), ' +
    'xr-spatial-tracking=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

export default {
  async fetch(request) {
    const response = await fetch(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }
    // strip any server fingerprint the origin exposes
    headers.delete('Server');
    headers.delete('X-Powered-By');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
