---
name: Localized public URLs
description: Public service and static-page URL behavior across Turkish and the eight visitor languages.
---

Public non-Turkish service and registered static-page URLs must use locale-specific final segments, while canonical Turkish slugs remain internal and continue to own the unprefixed Turkish route.

**Why:** Translating only the `/de`, `/en`, etc. prefix left an obvious Turkish URL suffix for international visitors and created an inconsistent SEO surface. Translating service links alone still left navigation and footer links such as `/de/hizmetler` untranslated.

**How to apply:** Derive a service or registered static page’s public locale path from its translated navigation label through the shared localized-service-path helper. Use that path for navigation, footer, generic locale links, language switching, canonical/hreflang, sitemap, and structured data. Continue resolving legacy `/{locale}/{turkish-canonical-slug}` links, but permanently redirect them to the locale-specific canonical URL.

The locale preference cookie is also authoritative for unprefixed public requests: when it holds a supported non-Turkish locale, redirect an unprefixed public URL to that locale’s canonical translated path rather than rendering Turkish.

**Why:** A direct or stale Turkish internal URL otherwise overwrites the visitor’s language context even though their active preference is already known.

**How to apply:** Preserve query strings while canonicalizing through the shared public-path helper. Exempt API, asset, admin, and locale-switch endpoints so this rule only governs visitor-facing navigation.

Service categories use the same localized services-base pattern as nested public landing pages: Turkish `/hizmetler/{category}`, and translated `/{locale}/{localized-services}/{category}` routes for every visitor language. Persisted category slugs may contain underscores as well as hyphens.

**Why:** Categories need stable, shareable URLs without changing the existing grouped services index. Admin-created legacy category slugs include underscores (for example `city_vip`), so treating only hyphenated values as valid silently makes real catalog pages unreachable.

**How to apply:** Build category links, language switches, canonical/hreflang values, and route resolution through the shared category-path helper. Keep category-slug validation strict to a single lowercase alphanumeric segment separated by hyphens or underscores; verify every seeded category, not only hyphen-free examples.