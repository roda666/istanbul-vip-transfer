---
name: Social OAuth public origin
description: Replit preview requests can reach Next.js through an internal HTTP hop; social OAuth must use the public HTTPS origin.
---

All social OAuth callback, fallback redirect, and popup postMessage origins must be built from `x-forwarded-host` (then a non-internal host fallback) with an explicit `https://` scheme.

**Why:** The reverse proxy can expose an internal URL such as `http://0.0.0.0:<port>` to the app, which is invalid externally and causes provider callback validation or error redirects to fail.

**How to apply:** Use the shared public-origin helper for every OAuth provider’s authorization callback, token exchange redirect URI, error/success fallback, and popup target origin. Never derive a public host from the raw backend request URL.