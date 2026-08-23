---
name: Public chrome cache
description: Performance rule for shared public header and footer data.
---

The public layout must read a compact, cacheable payload containing only navigation, footer, and contact values. It must not load full CMS page bodies or complete service documents merely to render shared chrome.

**Why:** The root layout participates in every public page request. Re-reading and parsing broad CMS data there increases TTFB for otherwise lightweight pages, including blog articles.

**How to apply:** Use the shared public-chrome cache for anonymous public layout rendering, keep its data minimal and locale-aware, and invalidate its tag whenever a service/category navigation entry, footer content, homepage footer section, or contact/site settings change. Do not use this cache for user-specific or protected admin rendering.