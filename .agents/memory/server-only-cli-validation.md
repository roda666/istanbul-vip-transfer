---
name: Server-only CLI validation
description: Run Next server-only utility checks from a command line without resolving them as client imports.
---

When a one-off Node or tsx validation script imports a module marked
`server-only`, run it with Node's `react-server` resolution condition.

**Why:** Outside the Next.js server runtime, the package otherwise resolves to
its intentional client-side throwing stub even though the utility itself is
valid for server execution.

**How to apply:** Use the server condition only for local operational checks of
server utilities. Keep the script's output sanitized: never print credentials,
raw recipient addresses, or raw provider responses.