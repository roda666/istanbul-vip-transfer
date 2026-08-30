---
name: Performance E2E environment
description: Reliable environment and sequencing for browser performance checks.
---

Run the complete browser performance suite against a production build, with build, dev, and overflow processes sequenced rather than sharing the same Next output directory.

**Why:** Next dev cold compilation inflates TTFB/FCP, and concurrent dev/build/test processes can corrupt or replace the active output and turn later assertions into connection failures. A production server produced stable results while preserving strict thresholds.

**How to apply:** Finish the production build first, start it on an isolated port, point the performance suite at that origin, and stop it before restoring the managed dev preview. Keep focused dev checks for fast iteration only.