---
name: Admin acceptance cleanup lifecycle
description: Prevent disposable admin accounts and browser processes from surviving interrupted admin Playwright runs.
---

Admin acceptance runs must use the canonical signal-aware runner, not invoke the dedicated Playwright config directly. The runner owns the Playwright process group, performs cleanup before and after a run, and strips package-manager argument separators before forwarding test filters.

**Why:** A shell timeout can detach Playwright descendants. Test admins may also remain referenced by nullable `NO ACTION` admin foreign keys such as catalog `updated_by` fields, and a standalone postgres.js singleton can keep Node alive after tests have reported completion.

**How to apply:** Use one UUID-scoped admin per worker. Cleanup only the test-email prefix; discover actual foreign keys to `admin_users`, null only matching nullable references, and refuse cleanup when a required reference exists. Close the standalone DB client before process exit and verify zero test-prefix admins after failures or signals.

For responsive smoke tests against Next development mode, navigate with `domcontentloaded` and capture viewport screenshots rather than waiting for the full `load` event or full-page screenshots.

**Why:** Cold route compilation and long admin pages can consume the whole test timeout after the UI assertions are already valid, producing false failures.

**How to apply:** Keep explicit loading-indicator, visible-content, overflow, and touch-target assertions. Warm the login route before a batch when the workflow has just restarted, and treat fixture/login timeouts separately from UI failures.

For large route-by-viewport screenshot matrices, a timeout after the target controls are already present is test-harness instability, not evidence that the responsive contract failed.

**Why:** Long single-worker matrices can spend minutes in route teardown or screenshot capture after assertions have succeeded, causing reruns to fail on screens that passed moments earlier.

**How to apply:** Keep screenshots viewport-sized, record explicit no-record/permission skips, and diagnose the first timeout from its trace before rerunning a bounded subset instead of restarting the entire matrix.