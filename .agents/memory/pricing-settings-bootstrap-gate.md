---
name: Pricing calculator settings bootstrap gate
description: price_calculator_settings (id=1) row does not exist until an admin saves the Fiyat Kuralları settings page once; every consumer of admin-pricing-service/admin-pricing-engine must treat its absence as "no data", not a bug.
---

`price_calculator_settings` (VAT rate/display mode, EUR/USD/TRY rounding) has no seeded row by default — only `/admin/api/pricing/settings` PUT (saving the admin settings page) does an `insert ... onConflictDoUpdate` to create id=1. Until that happens once, ANY code path that does `db.select().from(priceCalculatorSettings).where(id=1)` gets an empty result.

**Why:** This silently disables the entire real-pricing computation path (admin quote tool, and any new feature reusing `calculateAdminQuote`/`getCurrentExchangeRates`) with no error — it just looks like "no pricing data exists yet" everywhere, which is easy to misdiagnose as a matching/logic bug in new code rather than an unconfigured admin setting. Confirmed via direct SQL: table had 0 rows in an environment where routes/vehicles/pricing-profiles were otherwise fully populated.

**How to apply:** Before concluding a new pricing-dependent feature "found no data" is a code bug, check `select count(*) from price_calculator_settings` — if 0, the real fix is for the admin to open and save Fiyat Kuralları settings once (or seed the row with sane defaults matching the PUT handler's shape), not to change the feature's matching/computation logic. Verify the computation logic itself with a mocked policy object (call `calculateAdminQuote` directly) instead.
