---
name: Admin fast-quote custom points
description: Safety boundary between custom coordinates, catalog locations, and protected toll-route selection.
---

Open-address and map-pin inputs may be used directly for admin-only distance pricing. They must not create or guess a toll scenario by themselves. Toll alternatives become eligible only when each endpoint safely matches a nearby active catalog location and that ordered pair exactly matches an active stored route. Keep the user's manual saved-route selection separate from the effective route derived from exact endpoints: automatic matching must not mutate the saved-route selector. Review-only routes still require an explicit alternative selection.

**Why:** A free-form address or approximate map point can be close to several dense-city locations. Treating it as a route endpoint without a strict catalog boundary could silently apply the wrong real tariff.

**How to apply:** Preserve coordinate-first distance calculation, a narrow proximity threshold for catalog matching, exact directed route matching, and the existing review/default rules. Address autocomplete must use server-side provider calls and accept only a selected, coordinate-backed suggestion; unselected text is not a quote endpoint. Show the resolved coordinates and catalog match outside optional map controls. When invalidating an in-flight JSON POST in this UI, ignore its stale result rather than aborting the body mid-request, which can create a misleading 422 parse response. Keep every coordinate and toll detail inside protected admin APIs and UI.