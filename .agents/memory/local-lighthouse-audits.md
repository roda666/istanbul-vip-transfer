---
name: Reliable local Lighthouse audits
description: How to collect reproducible local production Lighthouse results in this workspace.
---

# Reliable local Lighthouse audits

Run the optimized production server and the Lighthouse commands inside the same
shell process, with a cleanup trap that stops the server after the reports
finish.

**Why:** a background production server launched by a one-off shell command can
be terminated when that command returns. Lighthouse then reaches a closed port
and reports Chrome's generic interstitial error rather than an application
failure.

**How to apply:** stop the dev workflow before building to avoid `.next`
contention, start `next start` on a temporary port, wait for a successful HTTP
response, run each audit, and terminate that server in the shell cleanup. Use
the same Lighthouse preset and categories for every before/after row.