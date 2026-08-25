---
name: Blog translation release gate
description: Required quality checks and safe release sequence for batches of localized blog articles.
---

Before a localized blog batch is published, verify every target-language record for:

- non-empty title and SEO metadata;
- no untranslated Turkish blocks or placeholder text;
- localized internal URLs that return successfully;
- no customer-visible bridge, tunnel, motorway, or crossing-fee copy;
- inline images retained with target-language alt text, and a localized cover-image alt;
- correct right-to-left behavior for Arabic.

Only records that pass every check may move through the editorial lifecycle in order: `DRAFT` → `REVIEW` → `APPROVED` → `PUBLISHED`. After direct batch writes or publication, invalidate public blog paths with the authenticated cache-revalidation mechanism so article pages, hreflang and sitemap do not serve stale content.

**Why:** A completed AI translation can still silently omit images, retain a Turkish URL, or carry disallowed operational route copy. Status changes alone are not a visitor-readiness signal.

**How to apply:** Treat the checks as a release gate for every future blog translation batch. Exclude failed language/article records from publication, report the exact reason, and re-run the scoped checks after repairs before changing their status.