---
name: Migration 0005 manual DDL fix
description: drizzle-kit migrate reported success but admin_notes and source columns were missing from reservation_requests; fixed by running ALTER TABLE directly.
---

## The rule
After running `drizzle-kit migrate`, always verify critical columns actually exist in the live DB before trusting "migrations applied successfully!" — the journal can record a migration as applied even if the DDL partially failed.

**Why:**
Migration 0005 added `admin_notes` and `source` to `reservation_requests`, plus enum values `ARCHIVED` and `SUPPRESSED`. The journal showed it applied, but `information_schema.columns` confirmed both columns were missing. INSERT calls that included those columns failed with "Database error" at runtime.

**How to apply:**
Run `executeSql({ sqlQuery: 'SELECT column_name FROM information_schema.columns WHERE table_name = ...' })` to spot-check key columns after any migration. If missing, run the DDL manually:
```sql
ALTER TABLE "reservation_requests" ADD COLUMN IF NOT EXISTS "admin_notes" text;
ALTER TABLE "reservation_requests" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'booking-form';
ALTER TYPE "request_status" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "newsletter_status" ADD VALUE IF NOT EXISTS 'SUPPRESSED';
```
These are idempotent (`IF NOT EXISTS`) so safe to re-run.
