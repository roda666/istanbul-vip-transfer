---
name: Production build memory recovery
description: Safely complete an Istanbul VIP Transfer Next production build when the workspace is memory constrained.
---

If an Istanbul VIP Transfer production build dies or times out without an exit message while the development workflow is running, temporarily stop only that artifact's web workflow, run the build, then restart the same managed workflow.

**Why:** The active Next development server can consume enough memory that a concurrent production build is terminated before reporting a result; the build completes normally once that memory is released.

**How to apply:** Do not stop unrelated artifacts or task processes. Use the managed workflow controls, verify the production build completes, restore the development route type reference if needed, then restart and inspect the web workflow logs.