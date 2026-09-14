---
name: Gate-pair acceptance test timing
description: Reliable browser-test rules for protected admin gate-pair mutations and controlled selects.
---

Protected admin mutation checks require the browser's same-origin request context. Direct Playwright request-context POSTs can omit browser provenance and fail with 403 even when the UI request is valid. Mutation controls must remain busy until their post-success refresh finishes, or overlapping refreshes can leave the visible list stale.

**Why:** Gate-pair and tariff-row acceptance flows produced false failures from non-browser request provenance, premature controlled-select saves, and actions becoming available before refreshed rows arrived. A disabled-reason tooltip also replaced an action's accessible name and made enabled actions impossible to locate by their visible label.

**How to apply:** Send protected mutation probes through `page.evaluate(() => fetch(...))`. Await post-mutation reloads before clearing busy state. After `selectOption`, wait for the selected value before Save. Keep each action's accessible name equal to its visible label; expose disabled reasons through title/help text. Scope audit cleanup to the fixture's unique temporary admin.