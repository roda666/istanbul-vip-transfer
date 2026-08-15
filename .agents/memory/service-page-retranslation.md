---
name: Service page retranslation pattern
description: How to bulk-retranslate service pages outside Next.js (bypassing server-only)
---

# Service Page Bulk Retranslation

## The Problem
`lib/ai/translate-service-page.ts` has `import 'server-only'` at the top.
Running it via `tsx` throws: `Error: This module cannot be imported from a Client Component module.`

## Solution
Write a standalone `.mjs` script that:
1. Imports `postgres` and `openai` directly (both are in node_modules)
2. Replicates `extractTranslatableFields` and `applyTranslatedFields` inline as plain JS functions
3. Calls OpenAI directly using the same prompt as the server function
4. Writes to `content_translations` via SQL directly

## Key Details
- DB table: `content_translations`, entity_type=`'service_page'`, entity_id=`content.id::text`
- Status flow for bulk publish: set `status='PUBLISHED'`, `published_at=now`, `draft_at=now`
- Run 4 languages in parallel per service with `Promise.allSettled()` for speed (~1 min for 7 services × 4 langs)
- "Turkish leakage" heuristic using `ğ/ı` chars has many false positives (Istanbul district names, Turkish proper nouns like Kadıköy, Beyoğlu, Uludağ, Maşukiye are kept correctly in all translations)
- Place names that stay untranslated are intentional (proper nouns)

**Why:** `server-only` is a compile-time guard, not a runtime one — bypassing it by going direct to the library is safe for admin scripts.

**How to apply:** When bulk translation is needed and the admin UI is not available (e.g. after a seed that marks all translations OUTDATED), write a one-off `.mjs` script and run with `node scripts/my-script.mjs`.
