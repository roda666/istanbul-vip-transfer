---
name: Service page content v2 injection
description: 14 v1 service page slugs updated with rich TR content; translation scripts and DB entity conventions.
---

## What was done
14 thin v1 service pages (body = hero+features only, no introBody/contentSections/faqs) were updated with rich ~500-600 word Turkish articles via `scripts/add-service-content.mjs`.

## The 14 slugs
istanbul-havalimani-transfer, sabiha-gokcen-havalimani-transfer, vip-transfer, sehirler-arasi-transfer, soforlu-arac-kiralama, otel-transfer, saglik-turizmi-transfer, kurumsal-vip-transfer, istanbul-bursa-transfer, istanbul-sapanca-transfer, istanbul-gunubirlik-turlar, sapanca-masukiye-turu, bursa-gunubirlik-tur, yalova-gunubirlik-tur

## DB structure (critical)
- Service page bodies are in `content` table (`content_type = 'SERVICE'`), NOT a separate `service_pages` table.
- Translations are in `content_translations` with:
  - `entity_type = 'service_page'` (lowercase with underscore, NOT 'SERVICE')
  - `entity_id = UUID of the content row` (cast via id::text), NOT the slug
  - `target_language_code` (NOT `lang` or `locale`)
  - `status` column (NOT `translation_status`)

## Translation scripts
- `scripts/add-service-content.mjs` — Phase 1 (inject TR body) + Phase 2 (translate 8 langs). Phase 2 times out at 112 tasks × ~6s per pair.
- `scripts/continue-service-translations.mjs` — Processes only OUTDATED rows; run multiple times until all PUBLISHED.
- Both use `postgres/cjs/src/index.js` + `openai/index.js` imports.

**Why:** Phase 2 needs multiple 4-5 minute runs because 112 translation calls × ~3s each = ~9 minutes total.

## How to apply
To check remaining OUTDATED translations:
```sql
SELECT ct.status, COUNT(*) FROM content_translations ct
JOIN content c ON c.id::text = ct.entity_id
WHERE ct.entity_type = 'service_page' AND c.content_type = 'SERVICE'
GROUP BY ct.status
```
Then run `node scripts/continue-service-translations.mjs` until all PUBLISHED.
