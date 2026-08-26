---
name: DB-backed rate limiter causes spurious vitest failures on repeated runs
description: Why contact/newsletter tests can start failing with 429 after several vitest runs in one session, unrelated to code changes
---

`lib/auth/rate-limit.ts` persists attempt counts in a real Postgres table (`rate_limit_entries`), keyed by identifier (e.g. `contact:<ip>`), with a 15-minute sliding window. Tests that hit rate-limited routes (e.g. `tests/unit/contact-newsletter-consent.test.ts`, key prefix `contact:10.0.0.x`) do NOT reset this table between test runs.

**Why:** Running the same test file repeatedly within a ~15 minute window (e.g. after each of several unrelated content-only changes in one session) increments the same DB rows each time. Once attempts exceed the max (5), previously-passing tests start returning 429 instead of their expected status, looking like a regression even though nothing in the route or test code changed.

**How to apply:** If vitest failures suddenly differ from the known baseline (see `vitest-running-and-known-failures.md`) and the diffs are unexplained 429s on rate-limited routes, don't assume your edit broke something — check/clear `rate_limit_entries` for the test's key prefix (`delete from rate_limit_entries where key like 'contact:10.0.0.%'`) and re-run before investigating further.
