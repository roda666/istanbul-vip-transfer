---
name: Service page translation seed
description: Pattern and details for seeding EN/DE/RU/AR translations for all 14 service pages via AI.
---

# Service Page Translation Seed

## The script
`artifacts/istanbul-vip-transfer/db/seed-service-translations.ts`

- Inline OpenAI calls (no server-only import) — uses `await import('openai')` inside the function
- Idempotent via `ON CONFLICT (entity_type, entity_id, target_language_code) DO NOTHING`
- Processes services in batches of `SERVICE_CONCURRENCY=2`, 4 locales per service in parallel
- Inserts as `status='PUBLISHED'` (migration context — static content was already live)
- Run: `npx tsx db/seed-service-translations.ts`

## Turkish URL structure
- TR service pages: `/{slug}` — **no `/tr/` prefix**
- Non-TR: `/{lang}/{slug}` (en, de, ru, ar, es, fr, it, nl)
- Middleware does NOT treat 'tr' as a NON_SOURCE_LOCALE prefix; `/tr/slug` routes to the catch-all with lang='tr' which likely 404s
- Screenshot at `/bursa-gunubirlik-tur` shows correct TR content ✓

## OUTDATED status flow
**Why:** PUBLISHED translations with a different source_hash must not silently re-translate — admin must review before re-publishing.

- `translateAndSave()` in `app/admin/api/service-pages/[id]/route.ts`:
  - If `existing.status === 'PUBLISHED'` and hash ≠ existing.sourceHash → SET `OUTDATED`, return early
  - All other statuses (DRAFT, REVIEW, APPROVED, FAILED, OUTDATED) → translate as normal
- POST `approve` action: 409 if OUTDATED
- POST `publish` action: 409 if OUTDATED
- `getPublishedServicePage` and `getPublishedServicePageLangs` in `lib/service-page-cms.ts`:
  - Status filter: `inArray(...status, ['PUBLISHED', 'OUTDATED'])` — OUTDATED content stays live on site

**How to apply:** Any time TR source is saved and published, PUBLISHED translations become OUTDATED. Admin must: Yeniden Çevir → review DRAFT → Onayla → Yayımla.

## DB state after seed (2026-08-14)
- 14 services × 4 locales (en/de/ru/ar) = 56 rows
- 63 PUBLISHED + 1 DRAFT (kurumsal-vip-transfer EN, pre-existing)
- 0 duplicates, 0 missing title/body
- 12 services have only basic body (hero + features + seo); no contentSections/FAQ
