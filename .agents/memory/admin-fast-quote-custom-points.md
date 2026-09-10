---
name: Admin fast-quote endpoint rules
description: Owner-approved input and toll-alternative behavior for the admin quick quote simulator.
---

The admin quick quote simulator uses only the Kalkış and Varış catalog dropdowns. Do not restore free-text hotel/address inputs or the map-pin picker unless the owner explicitly reverses this decision. An exact active directed endpoint pair automatically resolves the effective stored route without changing the optional saved-route selector. Render its Yol & Geçiş Alternatifi panel directly below the two dropdowns so the result is visible where the selection occurred. Review-only routes still require an explicit alternative selection.

**Why:** The owner explicitly removed custom inputs, and repeatedly reported the alternatives as missing when the panel rendered above the dropdowns and outside the current scroll position. Catalog-only exact matching is safer and the adjacent panel makes the result discoverable.

**How to apply:** Match only active routes whose origin and destination location IDs equal the selected dropdown IDs in the same direction. Keep manual-route selection independent. Preserve the existing default/review and vehicle/tariff safety rules. Maintain a browser regression that selects endpoints without selecting a saved route and verifies the alternatives panel and expected option names.