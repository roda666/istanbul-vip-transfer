---
name: Sitemap vs hardcoded noindex conflict pattern
description: app/sitemap.ts includes any DB-active/published page; it does not know about per-page hardcoded robots overrides in page.tsx files.
---

In Istanbul VIP Transfer, `app/sitemap.ts` decides sitemap inclusion purely from DB fields (status/isActive/indexable), but several static service page files under `app/*/page.tsx` hardcode `robots: { index: false, follow: true }` directly in `generateMetadata()`, independent of the DB. Found 2026-08-26: 6 slugs (`istanbul-bursa-transfer`, `istanbul-sapanca-transfer`, `istanbul-gunubirlik-turlar`, `sapanca-masukiye-turu`, `bursa-gunubirlik-tur`, `yalova-gunubirlik-tur`) are hardcoded noindex yet still appear in `sitemap.xml` (12 URL entries across TR + locale variants) — a "submitted URL marked noindex" conflict. Several of these same slugs are also the destinations of legacy-site 301 redirects (`next.config.ts`), so backlink authority is being funneled into pages Google is told not to index.

**Why:** the two systems (DB-driven sitemap generator vs. hand-authored per-page metadata) were built independently and never cross-checked against each other.

**How to apply:** before adding/removing a hardcoded `robots.index` override on any static page, check whether that slug is in `app/sitemap.ts`'s output and whether it's a redirect destination in `next.config.ts`; keep noindex pages out of the sitemap (or drop the override if the page should actually be indexed).
