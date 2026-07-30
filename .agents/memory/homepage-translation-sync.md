---
name: Homepage Translation Sync
description: Automatic multilingual synchronization for homepage CMS — field classification, AI translation pipeline, manual lock, status states.
---

## Architecture

On **TR draft save** (`PATCH /admin/api/homepage/tr` with `autoTranslate=true`):
1. Compute SHA-256 hash of all translatable text fields (`computeTranslatableHash`)
2. For each target locale (en/de/ru/ar):
   - **If manually locked + hash changed** → set status `OUTDATED`, write audit log, skip AI
   - **If hash unchanged** → skip entirely
   - **If AI key absent** → sync shared fields, set QUEUED, return `queued` status
   - **Else** → sync shared fields, call `translateHomepageFields()`, save as DRAFT

## Key files

- `lib/homepage-sync.ts` — `extractTranslatableFields`, `computeTranslatableHash`, `syncSharedFields`, `applyTranslatedFields`, `buildInitialTargetSections`
- `lib/ai/translate-homepage.ts` — flat-map OpenAI translation; input/output = `Record<string, string>` keyed by `section.field`
- `app/admin/api/homepage/[locale]/route.ts` — PATCH handles full sync pipeline
- `app/admin/api/homepage/[locale]/translate/route.ts` — POST: retry/force AI for one locale
- `app/admin/api/homepage/[locale]/lock/route.ts` — POST: toggle isManuallyLocked
- `app/admin/api/homepage/[locale]/publish/route.ts` — POST: action=publish|unpublish|approve
- `app/admin/api/homepage/bulk-publish/route.ts` — POST: publish all APPROVED locales
- `app/admin/(protected)/sayfalar/ana-sayfa/_HomepageEditor.tsx` — full editor with translation panel

## DB columns (migration 0007)

Added to `content_translations`:
- `source_hash text` — hash of TR translatable fields at last AI run
- `is_manually_locked boolean default false`
- `locked_at timestamp`
- `locked_by uuid FK admin_users`

## Status states (8)

NOT_STARTED → QUEUED → TRANSLATING → DRAFT → APPROVED → PUBLISHED | FAILED | OUTDATED

## Shared vs translatable fields

**Shared (copy, no AI):** hero.imagePath, hero.enabled, heroStats[].numberText/key/order/enabled, services.allServicesRoute/enabled, trustCards[].icon/id/order/enabled, trust/vehicles/reviews/reservation/contact.enabled, vehicles.ctaRoute, seo.ogImage/indexable

**Translatable (AI):** all text — badge, headlines, subheadline, CTAs, eyebrows, headings, descriptions, card titles/descriptions, stat labels, footer texts, all SEO text fields

## Safety rules (enforced in both route and prompt)

- AI output always saved as DRAFT — never APPROVED or PUBLISHED
- Manual lock prevents auto-overwrite; marks OUTDATED if source changes
- `OpenAI_API_KEY` absence = graceful QUEUED state, not crash
- Published public locales unaffected until admin explicitly publishes translated APPROVED row
