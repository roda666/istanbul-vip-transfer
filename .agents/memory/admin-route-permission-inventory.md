---
name: Admin route permission inventory
description: Prevent deny-by-default authorization gaps for new admin pages and APIs.
---

Every route under the protected admin page tree and every exported admin API method must be classified as explicitly permissioned, public, or cron-only. The complete inventory test must run before the production build.

**Why:** An unmapped Turnstile settings endpoint was denied by middleware, which left the UI in a misleading default state and blocked legitimate saves.

**How to apply:** When adding an admin route, add its central permission mapping in the same change. The route inventory test is the source of regression protection; do not bypass it by weakening deny-by-default behavior.