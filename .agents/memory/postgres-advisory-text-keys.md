---
name: PostgreSQL advisory text keys
description: Constraints for safely deriving transaction advisory-lock keys from canonical application identities.
---

Canonical identities sent to PostgreSQL `hashtextextended` must use a SQL-safe serialization such as JSON, not NUL-delimited text. Pass the hash seed as an explicit `bigint`.

**Why:** PostgreSQL rejects NUL bytes in `text`, and an untyped integer seed does not match the `hashtextextended(text, bigint)` signature. Either issue prevents the transaction from reaching its protected write.

**How to apply:** Whenever an application identity is bound into `hashtextextended` for `pg_advisory_xact_lock`, serialize its normalized parts without NUL and cast the seed to `bigint`; verify the exact expression against the development database.