---
name: Dashboard storage transport on Node 24
description: Why private recovery-object listing must stay off the dashboard SSR critical path until a mature Node 24-safe storage transport is available.
---

Do not call the Storage 7 private-object listing path during dashboard server rendering. Keep reservation fallback persistence and cleanup intact, but source the login landing dashboard's alert from the database.

**Why:** On Node 24, Storage 7 reaches both Google authentication and object requests through node-fetch 2 transports that call legacy `url.parse()`. Next dev surfaces DEP0169 as an error overlay, and the remote storage call extends the first dashboard response. The Node 24-safe Storage 8 release was too new for Replit's minimum-release-age firewall when investigated, while the mature 7.x backport still used the deprecated transport.

**How to apply:** Keep storage recovery writes outside the dashboard render path. Restore private fallback visibility only through a mature storage release or a separate, non-blocking admin endpoint whose transport has been verified under Node 24 with trace-deprecation.