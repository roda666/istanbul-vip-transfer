---
name: Gate-pair acceptance test timing
description: Reliable browser-test rules for protected admin gate-pair mutations and controlled selects.
---

Protected admin mutation checks require the browser's same-origin request context. Direct Playwright request-context POSTs can omit browser provenance and fail with 403 even when the UI request is valid.

**Why:** The gate-pair acceptance flow produced false failures when an invented-pair API check used `page.request`, and when Save was clicked before React re-rendered a controlled select with the newly selected pair.

**How to apply:** Send protected mutation probes through `page.evaluate(() => fetch(...))`. After `selectOption`, wait for the select to have the returned value before clicking Save. Scope audit cleanup to the fixture's unique temporary admin.