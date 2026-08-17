---
name: Homepage translation source-of-truth
description: Which content_translations rows homepage-cms.ts reads, the orphan problem that was fixed, and the auto-retranslate rule change.
---

## Rule
`homepage-cms.ts` reads `content_translations WHERE entity_type='homepage'`.
Rows with `entity_type='content'` for the same entity_id are NEVER read — they are orphans.

## History (fixed 2026-08-17)
- 8 orphan `entity_type='content'` rows existed (created by an earlier translation run that set wrong entity_type). Deleted.
- EN `entity_type='homepage'` row had old format body (`{"seo":...}`); `parseHomepageSections` returned null → hardcoded fallback served. Fixed by re-translating fresh from TR source.
- AR/DE/RU had July-30 translations (old but parseable). Fresh-translated.
- ES/FR/IT/NL had Aug-14 translations (already good). Fresh-translated for consistency.

**Script:** `artifacts/istanbul-vip-transfer/scripts/fix-homepage-translations.mjs`
Run if translations ever need resetting from TR source.

## Auto-retranslate guard fix (admin route)
`app/admin/api/homepage/[locale]/route.ts` — the guard that locks PUBLISHED translations when TR hash changes now checks `!tx.isAiGenerated`. AI-generated translations auto-retranslate on next TR save; only human-edited ones get locked and require manual unlock.

**Why:** homepage translations are always AI-generated; locking them required manual admin intervention on every TR edit, breaking the intended auto-sync flow.

## source_hash
All 8 non-TR rows now have `source_hash = e66def1af0f641da…` (SHA-256 of TR translatable fields as of 2026-08-17). On next TR save with changed content, `isAiGenerated=true` rows will auto-retranslate (no lock), `isAiGenerated=false` rows will lock.
