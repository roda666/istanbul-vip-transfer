---
name: Drizzle migration workflow
description: How schema changes are tracked and applied; current state of __drizzle_migrations table.
---

## Rule
New schema changes must go through `pnpm db:generate` then `pnpm db:migrate`. Do NOT use `pnpm db:push` for production schema changes — it bypasses the migration journal and leaves `__drizzle_migrations` out of sync.

**Why:** `db:push` was used historically, which is why migrations 0000–0015 existed as SQL files but `__drizzle_migrations` didn't. After running `drizzle-kit migrate` in Aug 2026, the tracking table now exists.

**How to apply:**
1. Edit `db/schema.ts`
2. `pnpm db:generate` — creates a new versioned SQL file in `drizzle/migrations/` and updates `_journal.json`
3. `pnpm db:migrate` — applies unapplied migrations and records them in `drizzle.__drizzle_migrations`

## Current state (Aug 2026)
- Migration journal: `drizzle/migrations/meta/_journal.json` — 17 entries (0000–0016)
- `drizzle.__drizzle_migrations` table: exists, 10 rows (created by first `drizzle-kit migrate` run)
- All migration SQL files use `CREATE TABLE IF NOT EXISTS` — safe to re-run

## Migration 0016 note
`0016_studio.sql` was hand-crafted (not via `db:generate`), so its journal entry was added manually by a Python script. The studio tables (studio_projects, studio_project_translations) were already in the DB via `db:push` before the migration system was set up.
