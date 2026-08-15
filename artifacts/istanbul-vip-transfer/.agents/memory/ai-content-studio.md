---
name: AI Content Studio
description: Full architecture of the /admin/ai-studio feature — DB schema, API surface, UI pages, and key type quirks.
---

## Tables (migration 0016_studio.sql — APPLIED)
studio_projects, studio_project_translations, studio_images, studio_research,
studio_distribution, studio_audit, studio_schedules

## Key TypeScript quirks
- `StudioConfig` has `[key: string]: unknown` index signature (needed for `as Record<string, unknown>` casts from DB jsonb)
- `keywords` field on StudioConfig is optional (`keywords?: string[]`); always use `(config.keywords ?? [])` before `.join()`
- Inner panel components close over outer state — use `const p = project` after `if (!project) return null` so TypeScript sees a narrowed non-null const
- `run()` helper accepts `() => Promise<unknown>` (not `Promise<void>`) since `api()` returns `Promise<Record<string, unknown>>`
- AdminPageHeader prop is `action` (singular), not `actions`

## contentTranslations schema (for publish route)
Column names: `entityType`, `entityId`, `targetLanguageCode`, `body` (not `bodyHtml`), `sourceLanguageCode`
Unique index: (entityType, entityId, targetLanguageCode)
Status enum: translationStatusEnum (PUBLISHED, NOT_STARTED, etc.)

## UI pages
- `/admin/ai-studio` — editorial calendar list
- `/admin/ai-studio/yeni` — 3-step project creation wizard
- `/admin/ai-studio/[id]` — full 10-stage workflow detail page

## API surface (all under /admin/api/studio/projects/[id]/)
research, draft, seo, image, approve, translations, translations/[lang],
export, distribution, schedule, publish, audit, config, slugs/check

**Why:** Avoid re-implementing column names from memory — always check schema.ts for contentTranslations.
**How to apply:** When writing any new route that touches contentTranslations, grep `db/schema.ts` for the column names first.
