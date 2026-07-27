---
name: Istanbul VIP Transfer — architecture decisions
description: Contact config, title pattern, nav architecture, draft scaffold system, blog infrastructure. All updated after Phase 1 nav/services build.
---

## Contact config rule
All phone numbers, WhatsApp URLs, email addresses, and the canonical site URL live exclusively in `artifacts/istanbul-vip-transfer/lib/site-config.ts` (the `SITE` const). No component or page file may hard-code these values. `Reviews.tsx` uses `SITE.googleBusinessUrl`.

**Why:** The owner changed the phone number once mid-build.

## Verified contact values (as of 2026-07-27)
- Display phone: `+90 532 660 08 47` · Tel URI: `tel:+905326600847`
- WhatsApp: `https://wa.me/905326600847`
- Email: `info@istanbulviptransfer.com`
- Google Business: `https://share.google/BaSBZMKi7j4AlQ5hO` — do NOT change
- Canonical base: `https://www.istanbulviptransfer.com`

## Title architecture
`app/layout.tsx` sets `title` as a plain string (no `template` object). Every public page sets its own complete, final title string. Next.js requires `template` when using `title: { default, template }` — using a plain string avoids the type constraint and the double-suffix bug.

## allowedDevOrigins rule (CRITICAL)
`next.config.ts` must list **bare hostnames only** (no `https://` scheme prefix). Next.js extracts `parsedOrigin.hostname` before comparing against `allowedDevOrigins`. Including schemes causes every `/_next/*` asset to 403 and the site to render as a blank black screen (only CSS background images visible). Correct config:
```ts
allowedDevOrigins: ['**.replit.dev', '127.0.0.1'],
```
`**.replit.dev` = recursive wildcard covering all Replit preview subdomains. `127.0.0.1` needed because Next.js only auto-allows `localhost`, not the IP.

**Why discovered:** After SEO Batch 1, the old config had `https://` prefixes. This blocked all JS/CSS.

## robots.txt
`public/robots.txt` was deleted. `app/robots.ts` is the single source.

## Navigation architecture (Phase 1)
Single source of truth: `lib/nav-config.ts` exports `NAV: NavEntry[]`. Both Header (desktop + mobile) and Footer consume this. The Hizmetler entry has `groups` (4 groups, 15 items total). Desktop: split link+chevron button pattern (link→/hizmetler, chevron toggles dropdown). Mobile: two-level accordion (Hizmetler → group → items).

Top-level nav order: Ana Sayfa · Hizmetler (dropdown) · Araçlarımız · Blog · Hakkımızda · İletişim · Rezervasyon Yap (cta=true).

## Draft scaffold system
All new/thin service pages carry `const DRAFT = true` at the top. Robots metadata reads from this flag: `robots: DRAFT ? { index: false, follow: true } : { index: true, follow: true }`. To publish a page: set `DRAFT = false` and add to `app/sitemap.ts`.

Draft routes (as of Phase 1): soforlu-arac-kiralama, otel-transfer, saglik-turizmi-transfer, kurumsal-vip-transfer, istanbul-bursa-transfer, istanbul-sapanca-transfer, istanbul-gunubirlik-turlar, sapanca-masukiye-turu, bursa-gunubirlik-tur, yalova-gunubirlik-tur.

## Blog infrastructure
`lib/blog-data.ts` exports typed `BlogPost` interface + `blogPosts[]` array (empty until first approved article). `BLOG_LIVE = blogPosts.length > 0`. Blog index is noindex. Slug page uses `generateStaticParams` returning empty array → zero static pages until articles are added. `BlogPosting` + `BreadcrumbList` schema only render on real article pages.

## Sitemap inclusions (Phase 1)
Indexed: /, /istanbul-havalimani-transfer, /sabiha-gokcen-havalimani-transfer, /vip-transfer, /hizmetler, /sehirler-arasi-transfer, /araclar, /hakkimizda, /iletisim.
Excluded: all 10 draft scaffold pages, /blog, /blog/[slug].

## Stale .next cache anti-pattern
Never run `pnpm build` (next build) while `next dev` is running — they share the `.next` directory. Running both simultaneously overwrites dev chunks with production chunks → dev server 500s. Always: stop dev → build → restart dev. Or: build → rm -rf .next → restart dev.

## Social media links
Instagram/Facebook/Twitter icons REMOVED entirely (were href="#"). Restore when owner provides real URLs.

## Build status after Phase 1
✓ Compiled · ✓ Lint · ✓ Types · 25/25 static pages (was 13 before Phase 1).
