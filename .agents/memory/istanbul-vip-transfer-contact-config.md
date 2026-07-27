---
name: Istanbul VIP Transfer — contact config architecture
description: Centralized contact info pattern; all contact strings live in lib/site-config.ts, never hard-coded elsewhere.
---

## Rule
All phone numbers, WhatsApp URLs, email addresses, and the canonical site URL live exclusively in `artifacts/istanbul-vip-transfer/lib/site-config.ts` (the `SITE` const). No component or page file may hard-code these values.

**Why:** The owner has already changed the phone number once mid-build. A single source of truth means any future update requires editing exactly one file.

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
