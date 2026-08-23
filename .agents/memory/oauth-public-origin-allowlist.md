---
name: OAuth public origin allowlist
description: Security rule for all OAuth callback and postMessage origins.
---

OAuth flows must derive callback URLs, fallback redirects, and popup postMessage origins only from the canonical site domain or explicitly configured Replit public domains. Request `Host` and `X-Forwarded-Host` values are usable only when they match that allowlist.

**Why:** OAuth redirect URIs are security-sensitive. Trusting arbitrary forwarded host values allows a hostile request to influence a redirect destination or callback origin.

**How to apply:** Keep the public-origin helper as the sole URL builder for social and Google OAuth. When adding a provider, add its callback path there and do not reconstruct an origin from request headers in the route.