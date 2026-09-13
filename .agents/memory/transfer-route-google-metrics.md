---
name: Transfer-route Google metrics
description: Safety rules for linking route endpoints and applying Google Routes distance/duration.
---

Automated transfer-route verification may link endpoints only when each legacy endpoint name maps to exactly one catalog location. Combined endpoints and missing catalog places must be skipped rather than guessed.

**Why:** A plausible but wrong location silently produces authoritative-looking distance and duration. Commercial prices and manually maintained normal/peak traffic windows are separate business decisions and must never be overwritten by a route-metrics backfill.

Route-content AI may run only after Google Maps returns both positive distance and duration. Coordinate estimates and model-generated numbers are not acceptable. AI output remains an unsaved form draft; it may fill only content/SEO fields and a catalog-validated service reference. Existing non-empty fields require explicit overwrite approval.

**Why:** A plausible AI-generated metric or invented service slug can look authoritative while corrupting customer-facing route facts. Keeping AI output in form state also preserves the normal save, translation-draft and manual-lock boundaries.

**How to apply:** Request both distance and duration from Google Routes. Update only endpoint IDs, approximate distance, reference duration, verification provenance and audit records. Preserve pricing fields and all normal/peak traffic fields. Keep the verified-route and coordinate estimate fallbacks for provider failures outside AI generation; if Google data is unavailable, stop AI generation with an explicit error.