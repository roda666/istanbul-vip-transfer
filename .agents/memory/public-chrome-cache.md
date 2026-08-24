---
name: Public chrome cache
description: Performance rule for shared public header and footer data.
---

The public layout must read a compact, cacheable payload containing only navigation, footer, and contact values. It must not load full CMS page bodies or complete service documents merely to render shared chrome.

**Why:** The root layout participates in every public page request. Re-reading and parsing broad CMS data there increases TTFB for otherwise lightweight pages, including blog articles.

**How to apply:** Use the shared public-chrome cache for anonymous public layout rendering, keep its data minimal and locale-aware, and invalidate its tag whenever a service/category navigation entry, footer content, homepage footer section, or contact/site settings change. Do not use this cache for user-specific or protected admin rendering.

The homepage has a separate locale-keyed aggregate cache for its CMS body,
catalog, routes, reviews, FAQ, service copy, and contact values. It shares the
public-chrome invalidation tag and five-minute freshness interval.

**Why:** The root layout must remain request-aware for language and cookie
consent, which prevents full-route static caching. Caching the aggregate data
still removes repeated database work without sacrificing the locale and consent
rules.

**How to apply:** Keep the full homepage aggregate out of the compact chrome
payload. When adding a new database-backed homepage surface, add it to the
aggregate reader and ensure its mutation path invalidates the public-chrome tag.