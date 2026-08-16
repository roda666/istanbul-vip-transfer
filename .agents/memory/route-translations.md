---
name: Transfer Route Translations
description: How route name/origin/destination i18n is stored and rendered for PopularRoutesSection
---

## Pattern
`transfer_routes` table has 3 JSONB columns: `name_translations`, `origin_translations`, `destination_translations`.
Shape: `{"en":"…","de":"…","ru":"…","ar":"…","fr":"…","es":"…","it":"…","nl":"…"}`.

Fallback: if lang is `tr` or key absent, use base `name`/`origin`/`destination` (Turkish).

## Component usage
`PopularRoutesSection.tsx` calls `useLang()` to get `lang`, passes it to `RouteCard`.
`RouteCard` calls `localize(base, translations, lang)` helper (defined in same file).

## Migration note
Migration 0020 added columns via `drizzle/migrations/0020_transfer_route_translations.sql`.
Journal entry was manually added to `meta/_journal.json` (idx=20, tag=`0020_transfer_route_translations`).
drizzle-kit may skip a migration if journal entry exists but SQL wasn't run — always verify with direct column check after `drizzle-kit migrate`.

**Why:** drizzle-kit reads journal to decide what to run; manually adding a journal entry does NOT execute the SQL. Use `ADD COLUMN IF NOT EXISTS` so direct SQL application is idempotent.

## Translation generation
`scripts/translate-routes.mjs` — translates all 8 routes in a single OpenAI batch call.
Idempotent: skips routes where `name_translations IS NOT NULL`.
