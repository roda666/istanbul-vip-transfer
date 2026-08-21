---
name: Localized service URLs
description: Public service URL and SEO behavior across Turkish and the eight visitor languages.
---

Public non-Turkish service URLs must use a locale-specific final segment, while canonical Turkish CMS slugs remain internal and continue to own the unprefixed Turkish route.

**Why:** Translating only the `/de`, `/en`, etc. prefix left an obvious Turkish URL suffix for international visitors and created an inconsistent SEO surface.

**How to apply:** Derive a service’s public locale path from its translated navigation label through the shared localized-service-path helper. Use that path for navigation, footer, service cards, language switching, canonical/hreflang, sitemap, and structured data. Continue resolving legacy `/{locale}/{turkish-canonical-slug}` links, but permanently redirect them to the locale-specific canonical URL.