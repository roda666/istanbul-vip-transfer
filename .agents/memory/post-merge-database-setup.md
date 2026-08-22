---
name: Post-merge database setup
description: Safe database work required after task-agent merges.
---

The post-merge script must apply the Istanbul VIP Transfer app's versioned `db:migrate` command after a frozen pnpm install. It must not call the separate `@workspace/db` package's `push` command.

**Why:** The workspace DB package has a different schema than the app database. Its schema-push command can propose destructive drops of application tables and asks for an interactive confirmation, which is unavailable in post-merge setup. The app migration journal and its seeds are idempotent and non-destructive.

**How to apply:** Keep the post-merge timeout long enough for a cold dependency install plus migration and seeds (currently 120 seconds). When schema work is merged, add versioned migrations to the app; do not bypass the journal with `db:push` or force a destructive prompt.