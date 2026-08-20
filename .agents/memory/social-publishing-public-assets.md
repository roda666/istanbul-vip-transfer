---
name: Social publishing public assets
description: Social test posts need an externally reachable image URL from the request's public origin, not a fixed site hostname.
---

For social publishing tests, resolve relative blog hero-image paths against the current request's public HTTPS origin.

**Why:** The configured production hostname can temporarily serve a different deployment and return HTML/404 for new app assets, while the active Replit preview serves the real JPEG. Instagram rejects a non-image response for `image_url`.

**How to apply:** Keep the requested public origin dynamic for relative test assets and verify it returns a successful `image/*` response before using it in the Instagram publishing flow.