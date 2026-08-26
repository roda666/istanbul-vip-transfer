---
name: Drizzle custom-migration journal timestamp ordering
description: Why a newly generated drizzle-kit migration can silently not run even though the CLI reports success.
---

If earlier custom (hand-written) migrations in `drizzle/migrations/meta/_journal.json` were given artificial
far-future `when` timestamps (e.g. `1789000000004` instead of a real epoch-ms value), a later migration
generated normally by `drizzle-kit generate` gets a real current epoch-ms `when` — which is *smaller* than
those artificial ones. `drizzle-kit migrate` treats journal order via `when`, so the new migration is silently
skipped: the CLI still prints "[✓] migrations applied successfully!" with no error, but the new migration's
DDL never runs (no error, no row added to `drizzle.__drizzle_migrations`).

**Why:** at least one prior migration in this project's history used sequential fake large `when` values
instead of real timestamps, breaking the assumption that `when` values are monotonically increasing with
real time.

**How to apply:** after generating a new migration, check `drizzle.__drizzle_migrations` (or query
`information_schema.columns`/`pg_constraint`) to confirm the new migration's DDL actually landed — don't
trust the CLI success message alone. If it's missing, compare the new entry's `when` in `_journal.json`
against the last few prior entries; if it is smaller, bump it to be strictly larger (continuing whatever
numbering scheme the prior custom migrations used) and re-run `drizzle-kit migrate`.

**Recurrence (2026-08-26):** hit again — two more generated migrations were silently skipped, and columns/
tables from an earlier session (`classification_label`, `banned_vehicle_classes`, `vehicle_toll_point_classes`)
that `__drizzle_migrations` showed as "applied" were actually absent from the live DB. This is a standing risk
in this project, not a one-off: always verify schema state directly against `information_schema` after any
`drizzle-kit migrate`, especially before writing seed/backfill scripts that assume new columns exist.

**Recurrence #3 (2026-08-26, same day):** a single new column (`site_settings.image_compression_max_kb`)
generated as migration 0070 was also silently skipped — `drizzle.__drizzle_migrations` had no row with its
hash, and the column was missing from `information_schema.columns`, right after `drizzle-kit migrate` printed
success. Manual fix each time: run the migration's own `ALTER TABLE` directly, then hand-insert a row into
`drizzle.__drizzle_migrations` with that migration file's real sha256 hash and a `created_at` one greater than
`MAX(created_at::bigint)` in that table — otherwise the same file will be silently skipped forever.
