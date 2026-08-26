---
name: Translation quality-repair audit trail
description: audit_logs has an authoritative record of the blog-translation quality repair pass — use it instead of reconstructing the fix list from memory/reasoning.
---

The `audit_logs` table (columns: admin_user_id, action, entity_type, entity_id, created_at, metadata jsonb) contains real, queryable history for blog translation repairs. For `entity_type = 'content_translation'`, action `'translation.quality_repair'`, `entity_id` is the `content_translations.id`; `metadata.locale` and `metadata.repaired` (array of category tags) describe what was fixed.

As of 2026-08-26, this action has exactly 64 rows, **all at the identical timestamp** (single-batch operation, not iterative rounds), covering exactly 8 blog slugs × 8 non-TR languages (ar/de/en/es/fr/it/nl/ru), each tagged with the same 4 categories: `localized_internal_links`, `inline_images`, `localized_alt_text`, `route_toll_copy`. No before/after body diff is retained anywhere (no revision table for translations) — only the category tags and scope are recoverable.

**Why:** A prior session's in-context reasoning had estimated "35 fixed translations across several manual rounds" without ever persisting or DB-verifying that number. When the user pushed for hard evidence, the real audit_log count (64, single batch, uniform categories) turned out to be the trustworthy answer — the "35" figure could not be substantiated and should not be repeated.

**How to apply:** Before answering any question about "what/how many translations were repaired/fixed" for this project, query `audit_logs` for `action='translation.quality_repair'` (join through `content_translations.id = entity_id` and `content.id = content_translations.entity_id` to get slug/locale) rather than relying on memory of the repair session. The category tags (not full-body rewrites) are themselves evidence that repairs were targeted/fragment-level, not full retranslations.
