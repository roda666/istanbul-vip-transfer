---
name: Localized public URLs
description: Public service and static-page URL behavior across Turkish and the eight visitor languages.
---

Public non-Turkish service and registered static-page URLs must use locale-specific final segments, while canonical Turkish slugs remain internal and continue to own the unprefixed Turkish route.

**Why:** Translating only the `/de`, `/en`, etc. prefix left an obvious Turkish URL suffix for international visitors and created an inconsistent SEO surface. Translating service links alone still left navigation and footer links such as `/de/hizmetler` untranslated.

**How to apply:** Derive a service or registered static page’s public locale path from its translated navigation label through the shared localized-service-path helper. Use that path for navigation, footer, generic locale links, language switching, canonical/hreflang, sitemap, and structured data. Continue resolving legacy `/{locale}/{turkish-canonical-slug}` links, but permanently redirect them to the locale-specific canonical URL.