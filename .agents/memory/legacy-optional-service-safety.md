---
name: Legacy optional-service safety
description: Safe migration and runtime rules for old optional-service catalog rows.
---

Do not silently rewrite, archive, deactivate, or “repair” real optional-service prices and records during catalog-contract migrations. Use legacy-safe constraints that enforce new writes, then explicitly exclude or reject invalid legacy rows at every public submission and pricing boundary.

Semantic aliases such as meet-and-greet must resolve to one deterministic runtime winner. Prefer the exact canonical key; otherwise use stable catalog ordering. Reject a request that explicitly selects multiple IDs for the same normalized service.

**Why:** Existing operational prices are real business data. Automatic normalization can change charges, while leaving invalid or duplicate legacy rows usable can expose bad currency values or double-charge a quote.

**How to apply:** When optional-service validation or keys change, verify raw IDs before semantic deduplication, quarantine invalid records in catalog/submit/pricing readers, and require an explicit admin decision for any real-row cleanup.