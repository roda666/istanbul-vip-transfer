---
name: Toll vehicle-class crosswalk and highway-corridor scope
description: Official KGM class_1..class_6 toll taxonomy, per-toll-point vehicle-class assignment (no global vehicles.tollClass), per-point banned-class field, per-point day/night hours, and why highway-corridor toll points are intentionally blank.
---

## Official KGM class taxonomy, assigned per (vehicle, toll point) — not a global vehicle field

The toll engine's vehicle classes are `class_1`..`class_6`, matching KGM's own axle-based ARAÇ TİPİ definitions (Sınıf 1 = 2-axle <3.20m wheelbase; Sınıf 2 = 2-axle ≥3.20m; Sınıf 3 = 3-axle; Sınıf 4 = 4-5 axle; Sınıf 5 = 6+ axle; Sınıf 6 = motorcycle).

**There is no `vehicles.tollClass` column.** Which class a vehicle counts as is assigned per crossing point, in the `vehicle_toll_point_classes` join table (unique per vehicle+point), because an operator's own classification can diverge from KGM's at a specific point (see Avrasya Tüneli below). An admin picks the class per vehicle per point in the vehicle edit form; a vehicle with no row for a given point resolves as "missing" (incomplete data, not zero) there, distinct from "this class is banned at this point."

**Why:** a prior iteration used one global `tollClass` field, but that can't express "this vehicle is Class 1 at the bridges but Class 2 at Avrasya" or "this vehicle can't legally use Avrasya at all." Per-point assignment plus a per-point ban list is required to model real-world class divergence and access bans correctly.

**How to apply:** any future toll pricing-data or engine work should read/write `vehicleClass` as `class_1..class_6` (see `TOLL_VEHICLE_CLASSES` in `lib/toll-management.ts`), resolved per point via `vehicle_toll_point_classes`, never a single vehicle-level field. Amounts may only be saved with a matching-domain official `sourceUrl` (enforced server-side via `assertVerifiedSourceForAmount`).

## Per-point banned vehicle classes (hard block, not a missing-tariff warning)

`toll_points` has `bannedVehicleClasses` (tri-state: `null` = unconfirmed/ask-owner, `[]` = confirmed no restriction, non-empty array = confirmed banned classes) + a required `bannedVehicleClassesSourceUrl` whenever non-null (enforced by `assertVerifiedSourceForBan`, mirroring the amount-source rule). `toll_points.classificationLabel` documents which classification system applies at that point (e.g. "KGM Resmî Sınıf 1-6" for the bridges, or a note that an operator's own system has been confirmed KGM-compatible).

**The pricing engine hard-rejects, it does not silently omit or warn.** `getRouteTollAlternatives` in `lib/toll-management.ts` resolves each vehicle's assigned class per point and flags `isBannedForSelectedVehicle`/`bannedPointNames` separately from `missingTariffPointNames` (unsourced/unassigned, not banned). `resolveTolls` in `lib/admin-pricing-service.ts` throws if a chosen route alternative includes a point banned for that vehicle's class there — it never falls back to a different alternative automatically or shows a $0/blank fee.

**Example — Avrasya Tüneli** (confirmed 2026-08-26 from the operator's own canonical page `https://www.avrasyatuneli.com/ucretlendirme/`): classes 1/2/6 are priced (Day ₺330/₺495/₺257.40, Night ₺165/₺247.50/₺128.70); classes 3/4/5 are `bannedVehicleClasses`, sourced to the operator's own "Yasaklı Araçlar" modal image (`https://www.avrasyatuneli.com/_assets/img/subpage/yasakli-araclar-modal.png`, which lists bicycles/scooters/buses/trucks/>2-axle/>5000kg/hazmat/>2.8m/N2-N3/O1-O4 freight as banned). The tariff page itself has no explicit effective-date text; `validFrom` (2026-07-01) is carried over from a separately-fetched announcement page whose amounts matched exactly — this gap is intentionally disclosed, never silently assumed.

## Vehicle-TYPE ban is a second, independent axis from vehicle-CLASS ban

A fleet vehicle's seat count/body style (`vehicles.pricingClass`: minivan/minibus/midibus/bus) is NOT the same thing as its axle-based KGM toll class, and a point can ban one without the other. `toll_points.bannedVehicleTypes` (same tri-state null/[]/list semantics + required `bannedVehicleTypesSourceUrl` as `bannedVehicleClasses`) exists specifically because Avrasya Tüneli's official "Yasaklı Araçlar" graphic bans "Otobüs" *categorically*, independent of axle count — a 2-axle bus would otherwise share `class_1`/`class_2` with an allowed car. Confirmed 2026-08-26: `bannedVehicleTypes: ['bus']` at Avrasya Tüneli; fleet `minibus` (Sprinter-type) is NOT banned; fleet `midibus` (yarım otobüs) is genuinely ambiguous in the official material and is left unconfirmed by design (never guessed from seat count).

**Why:** never infer an official vehicle ban from a fleet vehicle's seat count or "looks like a bus" reasoning — only from what the operator's own source explicitly states, and only for the exact `pricingClass` value it clearly covers.

**How to apply:** any new ban-type work must check the point's `bannedVehicleTypes` (via `vehicle.pricingClass`) as a hard-block *in addition to*, not instead of, the axle-class ban check — both `getRouteTollAlternatives` (admin listing) and `resolveTolls` (actual quote resolver, in `lib/admin-pricing-service.ts`) need the same two checks kept in sync; see the dual-implementation note in `toll-resolution-dual-implementation.md`.

## Real 2026 tariffs sourced directly from operator PDFs/pages (fetched/re-verified 2026-08-26)

15 Temmuz Şehitler Köprüsü + Fatih Sultan Mehmet Köprüsü share one KGM PDF tariff table (effective 01/01/2026); Yavuz Sultan Selim Köprüsü, Osmangazi Köprüsü, and 1915 Çanakkale Köprüsü each have their own KGM PDF (effective 01/07/2026) — all five bridges are confirmed `bannedVehicleClasses: []` (their own PDFs price all six classes with no exclusion, which is itself the evidence of no ban).

## Per-point day/night cutover hours (not global)

`toll_points.dayStartHour`/`nightStartHour` (nullable) let each crossing define its own day/night cutover independently, since only Avrasya Tüneli currently differentiates (05:00 day / 00:00 night start, per the operator's own page) while every bridge charges one flat rate. `resolveActiveTimeBandForPoint()` in `lib/toll-management.ts` defaults to the DAY band when a point has no hours configured, so non-differentiated points never need a NIGHT row.

## Highway-corridor toll points are placeholders by design

The 6 `HIGHWAY`-type points (İstanbul–İzmir otoyol ilave kesim + 5 "Güzergah" placeholders for Bursa/Sapanca/Ankara/Antalya/Bodrum) are scaffolded with a full class_1..class_6 row set each, but every row is deliberately left with a NULL amount and NULL source: Turkish otoyol segments beyond the named bridges/tunnel are either currently toll-free or charge distance-based OGS/HGS fees that a flat point×class model can't represent without a specific entry/exit pair and per-route km data (out of scope). This is the intended demonstration of "missing tariff ≠ zero," not a sourcing gap to close later without new scope.

Route → toll-alternative mappings (which bridge/tunnel/highway points attach to which seeded `transfer_routes`) are this agent's own geographic inference from each route's origin/destination side of the Bosphorus, not a sourced fact — an admin can edit alternatives per route from `/admin/yol-gecis-ucretleri`.

## Customer-leak guard pattern

Two guard scripts exist under `scripts/`: `check-toll-customer-leak-static.mjs` (scans `app/data/**` source text for any toll vocabulary, wired into `prebuild`) and `check-toll-customer-leak-live.mjs` (fetches every public `/data/*` endpoint against a running server and deep-scans the actual JSON response for toll-shaped keys/strings — needs `BASE_URL` pointed at the dev server's actual `$PORT`, which is per-artifact and not always 5000). Any new public endpoint should be added to the live script's `ENDPOINTS` list.
