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

## Generated migration scope check

Always inspect a newly generated SQL migration before applying it. If its metadata snapshot
lags changes that were already recorded by manually managed migrations, Drizzle can include
unrelated historical DDL alongside the intended schema change.

**Why:** Applying that generated catch-up SQL can recreate existing objects or bundle
unrelated product work into a focused change.

**How to apply:** Keep the generated journal/snapshot state, but reduce the new SQL migration
to the exact intended DDL after comparing it with the task scope; then run `pnpm db:migrate`
and verify the new columns/table exist.

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

## Verified-schema recovery

When the migration journal reports success but a required table or column is still absent
from the application's own database, treat the schema as the source of truth and verify
the exact relation/column through the app's `DATABASE_URL`.

**Why:** Historical journal records can cause `db:migrate` to skip SQL that has never
actually been applied, leaving a runtime dependency absent despite a successful command.

**How to apply:** Do not add startup DDL or change a historical journal entry blindly.
After confirming the exact missing migration objects, apply only that existing migration's
verified DDL to the application database, then query the expected tables and columns again.

## Migration 0016 note
`0016_studio.sql` was hand-crafted (not via `db:generate`), so its journal entry was added manually by a Python script. The studio tables (studio_projects, studio_project_translations) were already in the DB via `db:push` before the migration system was set up.
