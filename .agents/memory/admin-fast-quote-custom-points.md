---
name: Admin fast-quote endpoint rules
description: Owner-approved input and toll-alternative behavior for the admin quick quote simulator.
---

The admin quick quote simulator uses only the Kalkış and Varış catalog dropdowns. Do not restore free-text hotel/address inputs or the map-pin picker unless the owner explicitly reverses this decision. An exact active directed endpoint pair automatically resolves the effective stored route without changing the optional saved-route selector. If no exact route exists and the active endpoints are classified on opposite Istanbul sides, show every active toll point explicitly classified as a Bosphorus crossing, excluding crossings banned for the selected vehicle. Same-side and unclassified pairs never receive this fallback. Render the panel directly below the two dropdowns. Review-only routes still require an explicit alternative selection.

**Why:** The owner explicitly removed custom inputs. The recurring missing-panel problem was broader than scroll position: many valid cross-side endpoint pairs do not have an explicit route record, so an exact-route-only implementation cannot render alternatives for them.

**How to apply:** Prefer exact active directed routes. Otherwise require one EUROPEAN and one ASIAN endpoint plus an active Bosphorus-crossing marker. Revalidate the pair, point, vehicle bans and active tariff server-side before quote calculation. Keep manual-route selection independent. Maintain browser regressions for an unregistered cross-side pair and existing registered pairs.