---
name: Owner-approved unverified toll management
description: Owner decision for managing toll points whose fee evidence remains incomplete.
---

Unverified toll points remain editable by the admin. Do not use database triggers, API 409 guards, resolver filters, or disabled controls as a verification lock. Keep the “Doğrulanmamış ilave ücret” warning informational and preserve the independent rule that toll details never appear in customer APIs or UI.

**Why:** On 2026-09-11 the owner explicitly chose to remove the Ankara/Antalya/Bodrum verification-lock mechanism while preserving their existing inactive state, tariffs, alternatives, and customer-data boundary.

**How to apply:** Admin activation, tariff maintenance, imports, assignments, and alternatives must follow the normal authenticated rules even when evidence is unverified. Keep the warning and customer toll-leak checks; do not reintroduce lock gates without a new explicit owner decision.