---
name: Contact settings from DB
description: Pattern for serving phone/email/WhatsApp/googleBusinessUrl from site_settings DB table instead of hardcoded static config.
---

## Rule
All public-facing phone, email, WhatsApp, and Google Business URL values must come from `getContactSettings()` (server) or `useSiteSettings()` (client). Never read these fields from the static `SITE` constant in `lib/site-config.ts`.

**Why:** Admin panel at `/admin/ayarlar` can update contact info; the change must propagate to every page without a redeploy.

**How to apply:**
- **Server components / route handlers:** `import { getContactSettings } from '@/lib/site-settings-server'` → `const cs = await getContactSettings()`
- **Client components:** `import { useSiteSettings } from '@/components/SiteSettingsContext'` → `const cs = useSiteSettings()`
- **After admin save:** `app/admin/api/settings/route.ts` POST calls `invalidateContactSettings()` to flush the 5-min module-level cache.

## Fields available on ContactSettings
`phoneDisplay`, `phoneTel`, `phoneE164`, `whatsappNumber`, `whatsappUrl`, `whatsappFloatUrl`, `email`, `emailMailto`, `googleBusinessUrl`

## Static fields (stay in SITE constant)
`siteUrl`, `ogImage` — not in `site_settings` table; no need to make dynamic.

## Fallback
`getContactSettings()` falls back to the static `SITE` defaults if the DB row is missing or unreachable (so the site never breaks on a fresh DB).

## DB state
`site_settings` table has 1 row (id=1) seeded with current defaults. The `SiteSettingsProvider` is mounted in `app/layout.tsx` after fetching alongside other parallel server calls.

## Files converted (complete list as of Aug 2026)
Client: Header, Footer, Hero, Contact, WhatsAppFloat, Reviews
Server pages: app/page.tsx, app/[lang]/page.tsx, app/blog/page.tsx, app/[lang]/blog/page.tsx, app/[lang]/blog/[slug]/page.tsx, app/[lang]/[...slug]/page.tsx
Server components: components/ServicePageRenderer.tsx
Routes: app/llms.txt/route.ts (now force-dynamic), lib/ai/translate.ts (system prompt), app/admin/api/settings/route.ts
