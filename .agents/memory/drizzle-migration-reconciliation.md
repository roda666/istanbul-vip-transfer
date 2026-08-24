---
name: Drizzle migration reconciliation
description: How to safely recover when the Drizzle journal and live schema disagree.
---

If a schema object was created manually before its tracked migration runs, or the journal says a generated migration is applied while its columns are absent, make the generated SQL idempotent and reconcile only the missing live-schema objects. Do not bypass the migration ledger with an untracked schema push.

**Why:** Drizzle stops on an already-existing table, index, or constraint; a migration journal timestamp earlier than a database's last applied timestamp can also prevent the intended SQL from being selected. In this workspace the journal can therefore claim a migration is applied even though its generated SQL never reached the database. Both cases leave code and the migration ledger disagreeing about the schema.

**How to apply:** First inspect the migration ledger and live schema without exposing database credentials. Keep the generated migration as the source of truth, execute only its absent statements as idempotent SQL (including guarded indexes/constraints), rerun the dependent seed if applicable, and verify the columns and data exist.