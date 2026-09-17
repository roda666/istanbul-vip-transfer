---
name: Real AI acceptance cleanup
description: Safe cleanup rule for browser tests that mutate real CMS data through real AI providers.
---

Before a real-provider acceptance test attaches generated output, snapshot the exact DB fields and timestamps it can mutate. Restore those exact values in `finally` and verify the restored row. Do not use broad or partial admin update APIs for cleanup unless their contract is explicitly cleanup-safe.

**Why:** Normal admin APIs may require full payloads, sanitize structured JSON, reset publication state, or trigger translation/publication workflows. These behaviors can reject cleanup or produce additional user-visible changes.

**How to apply:** Use the real browser/API contract for generate, attach and reload assertions. Reserve direct DB writes for deterministic test cleanup, always scope them to captured record IDs, and close the ephemeral server afterward so process caches cannot retain generated values.