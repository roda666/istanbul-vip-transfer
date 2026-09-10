# PostgreSQL backup verification and restore

The admin backup page is restricted to `SUPER_ADMIN` and streams a PostgreSQL
custom-format archive (`.dump`) directly to the administrator's browser. It
does not retain archives in application storage or write their contents to
logs. Each completed download includes a matching `.sha256.txt` manifest.

## Verify before a restore

Use a trusted workstation with PostgreSQL client tools installed. Keep the
archive and its manifest together in restricted storage.

1. Compare the SHA-256 of the downloaded `.dump` to the value in its manifest.
   Use the platform's SHA-256 utility; do not paste customer data or database
   connection strings into tickets, logs, or chat.
2. Inspect the custom archive without restoring it:

   ```sh
   pg_restore --list path/to/backup.dump
   ```

3. Confirm the listing completes successfully and that the expected schema
   objects are present. Record the verification outcome in the approved
   operations system, not in this repository.

## Restore procedure (offline only)

Restores are an offline, authorized technical operation. Never restore through
the public application or the admin panel.

1. Obtain change approval, identify the intended target environment, and place
   that target in maintenance mode if required.
2. Take and verify a fresh backup of the target before making changes.
3. Use a least-privileged, temporary connection method supplied by the
   environment's secret manager. Do not put credentials in shell history,
   source files, or command examples.
4. Restore into an empty, approved target database with the PostgreSQL client
   version compatible with the dump:

   ```sh
   RESTORE_TARGET_DATABASE_URL='postgresql://...' \
   RESTORE_MAINTENANCE_ACK='I_UNDERSTAND_MAINTENANCE_RESTORE' \
   pnpm tsx scripts/restore-database.ts path/to/backup.dump path/to/backup.dump.sha256.txt
   ```

   For a recovery rehearsal, restore to an isolated database first. Do not use
   production customer data in an unapproved environment.
5. Run application migrations only when the target application's migration
   policy requires it, then perform approved functional and access checks.
6. Remove temporary archive copies according to retention policy and close the
   change record with the checksum and `pg_restore --list` verification result.

The helper reads both connection strings from environment variables (never
from command arguments), refuses equality with `DATABASE_URL`, production-like
deployment indicators without the explicit acknowledgement, populated targets,
checksum or format mismatches, partial/dangerous TOC listings, and restores
with one transaction and no owner/ACL. The target must be empty or a separately
isolated approved database. `pg_restore` options and restore ownership requirements vary by hosting
provider. Escalate to the database owner if the target requires additional
roles, extensions, or provider-specific restore steps.