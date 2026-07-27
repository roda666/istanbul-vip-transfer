---
name: Istanbul VIP Transfer — contact config & SEO architecture
description: Centralized contact info pattern + title/nav/link architecture decisions. All contact strings in lib/site-config.ts; title template removed; airport pages linked from nav/services/footer.
---

## Contact config rule
All phone numbers, WhatsApp URLs, email addresses, and the canonical site URL live exclusively in `artifacts/istanbul-vip-transfer/lib/site-config.ts` (the `SITE` const). No component or page file may hard-code these values.

`Reviews.tsx` uses `SITE.googleBusinessUrl` — it no longer has its own local const.

**Why:** The owner changed the phone number once mid-build. Single source of truth means any future update requires editing exactly one file.

## How to apply
- Components import `SITE` and/or `bookingWhatsAppUrl` from `@/lib/site-config`.
- Server pages import `SITE` for structured-data `telephone`/`email` fields and `siteUrl` for canonical/OG URLs.
- `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts` all derive the domain from `SITE.siteUrl`.

## Verified contact values (as of 2026-07-27)
- Display phone: `+90 532 660 08 47`
- Tel URI: `tel:+905326600847`
- WhatsApp URL: `https://wa.me/905326600847`
- Email: `info@istanbulviptransfer.com`
- Google Business Profile: `https://share.google/BaSBZMKi7j4AlQ5hO` — do NOT change
- Canonical base: `https://www.istanbulviptransfer.com`

## Title architecture (post-SEO batch 1)
`app/layout.tsx` sets `title` as a plain string (no `template` object). Every public page sets its own complete, final title string. The template approach was removed because Next.js's `%s | brand` template was appending the brand suffix to titles that already contained it, producing duplicate suffixes.

**Why:** Next.js requires `template` when using `title: { default, template }`. Using a plain string in the layout avoids the type constraint and the double-suffix bug.

**How to apply:** When adding a new page, write the complete desired title string directly in `metadata.title`. Do not rely on the layout appending anything.

## Target title strings (all under 50 chars)
| Route | Title |
|---|---|
| `/` | `İstanbul VIP Transfer \| Vito ve Sprinter Hizmeti` |
| `/istanbul-havalimani-transfer` | `İstanbul Havalimanı Transfer \| VIP Vito` |
| `/sabiha-gokcen-havalimani-transfer` | `Sabiha Gökçen Transfer \| VIP Vito` |
| `/vip-transfer` | `VIP Transfer İstanbul \| Vito ve Sprinter` |
| `/sehirler-arasi-transfer` | `Şehirler Arası VIP Transfer \| İstanbul` |
| `/araclar` | `VIP Araçlarımız \| Vito ve Sprinter` |
| `/hakkimizda` | `Hakkımızda \| İstanbul VIP Transfer` |
| `/iletisim` | `İletişim \| İstanbul VIP Transfer` |

## robots.txt
`public/robots.txt` was deleted. `app/robots.ts` is the single source. Build output confirms the `Sitemap:` directive is present.

## Navigation structure (7 nav items)
`navLinks` in `Header.tsx` now includes both airport pages:
Ana Sayfa → / | IST Transfer → /istanbul-havalimani-transfer | SAW Transfer → /sabiha-gokcen-havalimani-transfer | Hizmetler → /vip-transfer | Araçlar → /araclar | Hakkımızda → /hakkimizda | İletişim → /iletisim

Desktop nav gap reduced to `gap-5` (was `gap-8`) to accommodate the 7th item.

## Services.tsx (7 cards)
IST and SAW airport cards added as the first two cards (both with hrefs). Total: 7 cards in a `lg:grid-cols-3` grid (3+3+1 layout at desktop). The last card (Şehirler Arası) sits alone on the 3rd row.

## Footer
- quickLinks: 6 items (added /hakkimizda)
- services list: IST and SAW links added; Şehirler Arası Transfer already linked; Otel/Şehir Turu/Kurumsal/Özel Etkinlik remain plain text (no pages exist)
- Social media icons (Instagram/Facebook/Twitter) REMOVED — were href="#"

## Deferred to later phases
- Long-form content for thin service pages (IST, SAW, Şehirler Arası, Hakkımızda)
- Privacy policy and terms of service pages
- OG social share images
- Social media profile URLs (owner hasn't provided them)
- Footer copyright year static-build caveat
- Footer Rezervasyon link (/#rezervasyon vs #rezervasyon debate)
