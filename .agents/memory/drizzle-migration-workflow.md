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

## Journal timestamp ordering

The `when` value for a newly generated journal entry must be greater than the latest
`drizzle.__drizzle_migrations.created_at` value before running `db:migrate`.

**Why:** Drizzle selects pending migrations by this timestamp. Historical out-of-order
journal timestamps can make a new migration appear older than the latest applied record;
the command reports success while silently skipping its SQL.

**How to apply:** After generating a migration, if it does not create the expected table
or migration row, compare its journal `when` with the latest applied `created_at`. Move
only the new entry forward, re-run `db:migrate`, then verify both the schema and journal
row through the application's `DATABASE_URL`.

## Migration 0016 note
`0016_studio.sql` was hand-crafted (not via `db:generate`), so its journal entry was added manually by a Python script. The studio tables (studio_projects, studio_project_translations) were already in the DB via `db:push` before the migration system was set up.
