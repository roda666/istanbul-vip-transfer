---
name: Meta OAuth proxy callback URI
description: Replit preview requests can reach Next.js through an internal HTTP hop; Meta OAuth callbacks must preserve the public HTTPS origin.
---

Meta OAuth callback URLs must be formed with `x-forwarded-host` (then `host` as fallback) and an explicit `https://` scheme, rather than deriving an origin from the backend request URL.

**Why:** The reverse proxy may present an internal HTTP request to the app even though the browser uses HTTPS. Meta validates the public redirect URI exactly and rejects an internally-derived HTTP callback.

**How to apply:** Use the same shared callback URI helper for the authorization request and code-to-token exchange. Keep the public host dynamic so preview and production callback allowlists both work.