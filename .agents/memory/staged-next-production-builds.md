---
name: Staged Next production builds
description: Run a complete Next production build in separate compile and static-generation stages when a single command times out.
---

When the full `next build` run exceeds the environment command limit after compiling, validate the same production build in two stages: first run `next build --experimental-build-mode=compile`, then run `next build --experimental-build-mode=generate`.

**Why:** This project can compile successfully but spend enough time on static generation that a single build command reaches the tool's five-minute limit before it prints the final route summary.

**How to apply:** Keep the normal full build as the first choice. Only use the two stages to complete the same build when the direct command has already timed out. Run the package prebuild checks separately if calling the Next CLI directly, and restore the generated `next-env.d.ts` route reference if it changes from the development reference.