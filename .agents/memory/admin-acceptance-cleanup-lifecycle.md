---
name: Admin acceptance cleanup lifecycle
description: Prevent disposable admin accounts and browser processes from surviving interrupted admin Playwright runs.
---

Admin acceptance runs must use the canonical signal-aware runner, not invoke the dedicated Playwright config directly. The runner owns the Playwright process group, performs cleanup before and after a run, and strips package-manager argument separators before forwarding test filters.

**Why:** A shell timeout can detach Playwright descendants. Test admins may also remain referenced by nullable `NO ACTION` admin foreign keys such as catalog `updated_by` fields, and a standalone postgres.js singleton can keep Node alive after tests have reported completion.

**How to apply:** Use one UUID-scoped admin per worker. Cleanup only the test-email prefix; discover actual foreign keys to `admin_users`, null only matching nullable references, and refuse cleanup when a required reference exists. Close the standalone DB client before process exit and verify zero test-prefix admins after failures or signals.