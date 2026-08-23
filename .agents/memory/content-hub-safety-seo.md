---
name: Content Hub safety and SEO
description: Rules for AI article claims, internal links, sources, and interrupted drafts.
---

AI article generation may include verifiable operational facts such as distance, duration, vehicle capacity, baggage capacity, and recommended airport arrival lead time. It must still prohibit prices, currency, discounts, guarantees, and unverified official/legal claims.

**Why:** Concrete operational answers improve useful search content, while commercial claims become stale or create legal risk.

**How to apply:** Enforce the claim policy with one multilingual deterministic detector, not only a prompt. Build internal-link choices from the currently published site catalog and remove anything outside that catalog before persistence; never treat markdown image URLs as article links. Treat AI-proposed sources as unverified, safe-render only HTTP(S) URLs (including legacy rows), and make truncated generation a warned draft that cannot auto-publish.