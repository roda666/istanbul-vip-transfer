---
name: Reservation idempotency recovery
description: Durable rules learned from a concurrent keepalive retry that looked like a lost reservation.
---

Treat the browser-generated submission ID as the reservation idempotency key. A duplicate-key result can mean another concurrent request already committed successfully; resolve and return that committed request rather than recording a write failure. Existing-key replay must run before new-submission rate limiting.

**Why:** A QA submission was successfully committed, then an overlapping keepalive retry passed its pre-insert lookup before the first commit became visible. The second insert hit the submission-ID uniqueness constraint and created a false “lost reservation” incident under a different reference number.

**How to apply:** Preserve one submission ID across all browser retries, use conflict-safe insertion followed by a committed-row lookup, and return success only after the server confirms persistence. Store true failed-write payloads in the recovery table, with private App Storage as an independent fallback when the primary database cannot accept recovery data. Resolve both recovery channels when the request is later found or saved.