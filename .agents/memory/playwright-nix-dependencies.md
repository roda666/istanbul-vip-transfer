---
name: Playwright Nix dependencies
description: Headless Chromium browser tests need explicit shared-library dependencies in this Nix workspace.
---

When Playwright's cached Chromium fails to start with a missing `.so` error, use `ldd` on the Chromium executable to identify all absent shared libraries, then install the corresponding Nix dependencies through the package-management workflow before retrying browser tests.

**Why:** Browser test failures can be environment boot failures rather than application regressions. Installing only the first reported library repeatedly hides the complete dependency set and delays meaningful UI verification.

**How to apply:** After installing system libraries, restart the affected web workflow, confirm `ldd … | grep 'not found'` has no output, then rerun the narrow browser regression first. The current known Chromium library set includes GLib, NSPR/NSS, accessibility, DBus, X11, GBM, XKB, and ALSA libraries.