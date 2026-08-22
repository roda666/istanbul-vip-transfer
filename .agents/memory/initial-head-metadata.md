---
name: Initial head metadata
description: Keep critical SEO metadata available in the first streamed HTML head.
---

For public landing pages whose title, description, canonical, and hreflang are essential to crawlability, use static route metadata when the values are stable across a release rather than database-backed `generateMetadata`.

**Why:** Awaiting database work in `generateMetadata` can stream these tags after the initial `<head>`. Browser audit tools and some crawlers may then report a missing description even though the final DOM eventually contains it.

**How to apply:** Keep the core, locale-aware canonical/alternate mapping as static metadata for the public route. Continue to render CMS-managed page body content normally; only use dynamic metadata when it must genuinely vary per request and verify the raw initial head afterward.