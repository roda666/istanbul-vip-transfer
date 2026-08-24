---
name: Drizzle migration reconciliation
description: How to safely recover the standard Drizzle migration path after a manually-created schema object or an out-of-order migration timestamp.
---

If a schema object was created manually before its tracked migration runs, make that *unapplied* migration idempotent and then run the normal migration command. Do not bypass the migration ledger with an untracked schema push.

**Why:** Drizzle stops on an already-existing table, index, or constraint; a migration journal timestamp earlier than a database's last applied timestamp can also prevent the intended SQL from being selected. Both leave code and the migration ledger disagreeing about the schema.

**How to apply:** First inspect the migration ledger and live schema without exposing database credentials. Keep the generated migration as the source of truth, use idempotent SQL only for the already-created object, ensure the new journal entry orders after all applied entries, then rerun the normal migrator and verify the columns exist.