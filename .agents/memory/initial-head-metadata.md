---
name: Initial head metadata
description: Keep critical SEO metadata available in the first streamed HTML head.
---

For public landing pages whose title, description, canonical, and hreflang are essential to crawlability, use static route metadata when the values are stable across a release rather than database-backed `generateMetadata`.

**Why:** Awaiting database work in `generateMetadata` can stream these tags after the initial `<head>`. Browser audit tools and some crawlers may then report a missing description even though the final DOM eventually contains it.

**How to apply:** Keep the core, locale-aware canonical/alternate mapping as static metadata for the public route. Continue to render CMS-managed page body content normally; only use dynamic metadata when it must genuinely vary per request and verify the raw initial head afterward.

Next.js 15 production can still stream a static child description when the root
layout awaits request data. An empty route-specific `<head>` may appear to hoist
the metadata in development but is optimized away in production.

**Why:** Global `htmlLimitedBots: /.*/` fixed the audit but measurably delayed
FCP/LCP because it blocked the whole document on metadata. A homepage-only
request marker plus a literal initial-head description fixed the crawler view
without globally disabling streaming.

**How to apply:** Test raw HTML from `next start`, not only `next dev`. Keep the
manual fallback route-scoped, identical to canonical metadata, and retain normal
streaming for all other routes.