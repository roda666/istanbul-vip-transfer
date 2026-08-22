---
name: Migration 0005 manual DDL fix
description: A migration journal can report success even when critical DDL is missing; live-schema verification and idempotent repair are required.
---

## The rule
After running `drizzle-kit migrate`, always verify critical columns actually exist in the application database before trusting "migrations applied successfully!" — the journal can record a migration as applied even if the DDL did not take effect.

**Why:**
The migration journal has twice moved ahead of the live schema: it reported applied changes whose columns were absent. Any runtime query that relies on the declared schema can then fail despite a successful migration command.

**How to apply:**
Run `executeSql({ sqlQuery: 'SELECT column_name FROM information_schema.columns WHERE table_name = ...' })` to spot-check key columns after any migration. If any critical column is missing, run equivalent, idempotent DDL manually and re-query the schema before verifying the feature:
```sql
ALTER TABLE "target_table" ADD COLUMN IF NOT EXISTS "target_column" text;
```
These are idempotent (`IF NOT EXISTS`) so safe to re-run.
