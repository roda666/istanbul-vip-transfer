---
name: Istanbul VIP Transfer — architecture decisions
description: Contact config, title pattern, nav architecture, draft scaffold system, blog infrastructure, content phase pages. Updated after Content Phase 1.
---

## Contact config rule
All phone numbers, WhatsApp URLs, email addresses, and the canonical site URL live exclusively in `artifacts/istanbul-vip-transfer/lib/site-config.ts` (the `SITE` const). No component or page file may hard-code these values.

## Verified contact values (as of 2026-07-27)
- Display phone: `+90 532 660 08 47` · Tel URI: `tel:+905326600847`
- WhatsApp: `https://wa.me/905326600847`
- Email: `info@istanbulviptransfer.com`
- Google Business: `https://share.google/BaSBZMKi7j4AlQ5hO` — do NOT change
- Canonical base: `https://www.istanbulviptransfer.com`

## Title architecture
`app/layout.tsx` sets `title` as a plain string (no `template` object). Every page sets its own complete title.

## allowedDevOrigins rule (CRITICAL)
`next.config.ts` must list **bare hostnames only** (no `https://` scheme prefix). Correct config:
```ts
allowedDevOrigins: ['**.replit.dev', '127.0.0.1'],
```

## robots.txt
`public/robots.txt` was deleted. `app/robots.ts` is the single source.

## Navigation architecture
Single source of truth: `lib/nav-config.ts` exports `NAV: NavEntry[]`. Both Header (desktop + mobile) and Footer consume this.

Group labels (confirmed per spec):
- "Havalimanı Transferleri" — IST, SAW
- "Özel Transfer Hizmetleri" — VIP, Şehirler Arası, Şoförlü, Otel, Sağlık, Kurumsal
- "Popüler Rotalar" — Bursa, Sapanca only
- "Turlar" — 4 day-tour routes

Desktop nav breakpoint: `xl:` (1280px+). Hamburger shows at `< xl`. Previously `lg:` caused crowding at 1024–1279px range.

## Draft scaffold system
`const DRAFT = false/true` at top of each page. Robots metadata derived from it. When DRAFT=true: noindex. To publish: DRAFT=false + add to sitemap.ts.

## Content Phase 1 — completed pages (DRAFT=false, indexed)
- /soforlu-arac-kiralama — Şoförlü Araç Kiralama
- /otel-transfer — Otel Transfer
- /saglik-turizmi-transfer — Sağlık Turizmi Transfer
- /kurumsal-vip-transfer — Kurumsal VIP Transfer

Each has: unique H1, intro + service detail sections, "who it's for" section, reservation process, VehicleFleet, BookingForm, ServiceFAQ (5 items), related service links, Contact, BreadcrumbList + Service schema.

## Shared component: ServiceFAQ
`components/ServiceFAQ.tsx` — client component, accepts `items: {q, a}[]` + optional `heading`. Used by the 4 Content Phase 1 pages. Each page defines its own 5 FAQs inline.

## Content still draft/noindex (6 routes)
istanbul-bursa-transfer, istanbul-sapanca-transfer, istanbul-gunubirlik-turlar, sapanca-masukiye-turu, bursa-gunubirlik-tur, yalova-gunubirlik-tur.

## Sitemap inclusions (after Content Phase 1)
13 indexed routes: /, IST, SAW, /vip-transfer, /hizmetler, /sehirler-arasi-transfer, /soforlu-arac-kiralama, /otel-transfer, /saglik-turizmi-transfer, /kurumsal-vip-transfer, /araclar, /hakkimizda, /iletisim.
Excluded: 6 draft scaffolds, /blog, /blog/[slug].

## Content rules (never invent)
No prices, distances, travel times, unverified passenger counts, guarantees, awards, company history, licences, fake reviews or statistics.

## Blog infrastructure — LIVE
`lib/blog-data.ts` — 3 published articles. `BLOG_LIVE = true`.
Slugs: `istanbul-havalimani-transfer-rehberi`, `sabiha-gokcen-transfer-rehberi`, `vip-transfer-ile-taksi-arasindaki-farklar`.
`components/ArticleBody.tsx` renders markdown-like body strings (##, ###, - list, **bold**, [text](url)).

## Blog back-links from service pages
IST and SAW airport pages each link to their matching rehberi + VIP-vs-taxi articles.
VIP transfer page links to all 3 articles.
Pattern: `<section className="py-16 bg-gray-50">` containing a responsive grid of `<Link>` cards, placed before JSON-LD scripts.

## Sitemap inclusions (current)
16 indexed routes: /, IST, SAW, /vip-transfer, /hizmetler, /sehirler-arasi-transfer, /soforlu-arac-kiralama, /otel-transfer, /saglik-turizmi-transfer, /kurumsal-vip-transfer, /araclar, /hakkimizda, /iletisim, /blog, 3 blog article URLs.
Excluded: 6 draft scaffolds.

## Stale .next cache anti-pattern
Never run `pnpm build` while `next dev` is running. Stop dev → build → rm -rf .next → restart dev.

## Social media links
Removed entirely — restore when owner provides real URLs.

## Build status (current)
✓ Compiled · ✓ Lint · ✓ Types · 28/28 static pages.
