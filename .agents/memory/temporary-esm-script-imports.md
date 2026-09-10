---
name: Temporary ESM script imports
description: Package resolution rule for one-off Node ESM scripts executed outside an artifact directory.
---

Temporary ESM scripts stored under `/tmp` cannot use the relative package imports copied from scripts inside an artifact. Use verified absolute paths through the artifact's `node_modules` symlinks, and inspect the package's actual entry file before running.

**Why:** ESM resolves relative imports from the temporary script's own location. Guessing pnpm store versions or package entry layouts causes the script to fail before doing useful work.

**How to apply:** Before running a temporary ESM script, resolve each dependency symlink with `readlink -f` and inspect the package entry path. Prefer the artifact's stable `node_modules/<package>/...` symlink path over a version-specific pnpm store path.