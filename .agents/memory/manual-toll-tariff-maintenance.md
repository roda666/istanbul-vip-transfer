---
name: Manual toll tariff maintenance
description: Durable policy for how official toll amounts enter and remain protected in the pricing system.
---

Toll tariff updates must come only from a PDF/Excel file supplied by the owner or explicit manual entry. Do not build or run automatic/live tariff-fetch mechanisms. Store owner-supplied official-document amounts as manual values with the source URL and effective date; automatic values must not displace them.

**Why:** The owner explicitly chose a controlled document/manual workflow so verified tariffs and route-specific scope decisions cannot be silently changed by an external calculator or automated synchronization.

**How to apply:** For every future toll update, require the provided document or manual values, preserve existing verified/manual rows outside the named scope, record provenance and effective date, and verify combined corridor amounts do not duplicate a standalone bridge item.