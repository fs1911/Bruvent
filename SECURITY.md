# Security Policy

## Reporting a vulnerability

If you discover a security issue in this website, please report it privately:

- **Email:** hallo@bruvent.com
- **Machine-readable contact:** [`/.well-known/security.txt`](./.well-known/security.txt) (RFC 9116)

Please include steps to reproduce and, if possible, a proof of concept. We aim
to acknowledge reports within a few working days. Please do **not** open a public
issue for security matters, and please do not run automated scanning that
degrades service for others.

## Scope

This is a **static** marketing website (HTML/CSS/JS) served over HTTPS via GitHub
Pages. There is no application backend, no database, and no user accounts. The
contact form does not transmit data to a server — it opens the visitor's own
email client (`mailto:`), so no form data is stored by this site.

## Hardening in place

- **Content-Security-Policy** (`default-src 'self'`) — no third-party scripts,
  styles, fonts, frames, or connections are allowed to load.
- **First-party only** — fonts are self-hosted; there are no CDNs, trackers,
  analytics, or Google Fonts. No cookies are set.
- **Subresource Integrity (SRI)** on all vendored JavaScript libraries.
- **No inline scripts or inline style attributes** — the CSP requires no
  `unsafe-inline`.
- **Referrer-Policy: no-referrer**, `base-uri 'none'`, `object-src 'none'`,
  `form-action 'self'`, and `upgrade-insecure-requests`.
- **Clickjacking guard** — a frame-buster compensates for GitHub Pages not being
  able to send `X-Frame-Options` / `frame-ancestors` response headers.
- External links use `rel="noopener noreferrer"`; the contact form has a
  honeypot spam trap and input length limits.

## Note on response headers

GitHub Pages cannot set arbitrary HTTP response headers (e.g. `Strict-Transport-
Security`, `X-Content-Type-Options`, `Permissions-Policy`, or a header-based
`Content-Security-Policy` with `frame-ancestors`). These are best delivered by
putting a reverse proxy/CDN (e.g. Cloudflare) in front of the custom domain.
The header equivalents that *can* be expressed in HTML `<meta>` tags are already
applied.
