---
name: Running tests in istanbul-vip-transfer and known pre-existing failures
description: package.json has no "test" script — use vitest directly. Records the exact current set of pre-existing failing tests so future sessions don't need to re-derive or misattribute them.
---

`artifacts/istanbul-vip-transfer/package.json` has no `"test"` script; `pnpm test`
exits silently with no output. Run `pnpm exec vitest run` directly from that
artifact directory.

As of 2026-08-26 the suite has 5 pre-existing failures split across **two**
files (not all in one file — an earlier session's report incorrectly assumed
all 5 were in `contact-newsletter-consent.test.ts`; always re-verify by running
the suite rather than trusting a remembered count):

- `tests/unit/admin-pricing-engine.test.ts` > `admin pricing engine > includes tolls in round-trip net, VAT, and converted rounded totals` (1 failure — toll-inclusive round-trip totals mismatch; unrelated to contact/newsletter work)
- `tests/unit/contact-newsletter-consent.test.ts` (4 failures):
  - `contact form newsletter consent > does not create newsletter records when consent is unchecked`
  - `contact form newsletter consent > creates an active subscriber and localized granted-consent event when opted in`
  - `contact form newsletter consent > reactivates an existing subscriber and still records a fresh consent event`
  - `contact form newsletter consent > rejects an unsupported locale before creating contact or consent records`

**Why:** these predate unrelated feature work (menu/categories/internal-links/pricing-badge changes) and are out of scope to fix incidentally — but the exact names must be reported precisely, not approximated.
