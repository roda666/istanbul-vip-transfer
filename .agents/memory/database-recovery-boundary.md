---
name: Database recovery boundary
description: Safety boundary for validating backups and restoring them without risking the live database.
---

The admin web interface may create and validate backups, but it must never restore an archive into the live application database.

**Why:** A checksum proves file integrity, not that an archive is complete or safe. Uploading and restoring through the web process also creates memory-exhaustion and live-data-loss risks.

**How to apply:** Perform real restores only as an offline maintenance operation into a separately configured, empty target database. Require explicit acknowledgement, reject source/target identity, enforce archive-size and exact table/TOC allowlists, and use a transactional restore. Test recovery with synthetic data in isolated temporary schemas.