---
name: Transfer-route Google metrics
description: Safety rules for linking route endpoints and applying Google Routes distance/duration.
---

Automated transfer-route verification may link endpoints only when each legacy endpoint name maps to exactly one catalog location. Combined endpoints and missing catalog places must be skipped rather than guessed.

**Why:** A plausible but wrong location silently produces authoritative-looking distance and duration. Commercial prices and manually maintained normal/peak traffic windows are separate business decisions and must never be overwritten by a route-metrics backfill.

**How to apply:** Request both distance and duration from Google Routes. Update only endpoint IDs, approximate distance, reference duration, verification provenance and audit records. Preserve pricing fields and all normal/peak traffic fields. Keep the verified-route and coordinate estimate fallbacks for provider failures.