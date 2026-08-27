---
name: Vehicle Fleet DB-driven system
description: Public vehicle cards and vehicle-page schema share a DB-backed localization contract with no Turkish fallback.
---

## Rule
Public vehicle cards and vehicle-page JSON-LD must use the same resolver. For a non-Turkish locale, a vehicle is omitted unless its localized name, short description, and tagline are all present; neither the API nor the UI may fall back to Turkish or static cards.

**Why:** A static fallback can show archived or untranslated vehicles even when the database safely filters them, while separate SSR logic can leak Turkish descriptions into structured data.

## Key behavior
- Vehicle features may arrive as legacy code strings or `{ icon, label }` objects. Render feature codes through localized labels and never expose an admin-stored Turkish label on a non-Turkish page.
- JSON-LD built from vehicle translations must use safe JSON serialization because vehicle copy is admin-controlled.

## DB schema
`vehicles` table has `name_translations`, `short_desc_translations`, `tagline_translations` JSONB (migration 0023).
Public API at `app/data/vehicles/route.ts` returns `displayName`, `displayShortDesc`, `displayTagline` resolved from JSONB per `?lang=`.

## How to apply
Any future admin vehicle CRUD UI must keep the three public translation maps complete before publishing a non-Turkish vehicle card. Reuse the shared resolver for new public surfaces rather than implementing per-page fallback logic.

## Amenity/feature defaults (added 2026-08-27)
A vehicle's own non-empty `features` array always wins (a real per-vehicle exception); an empty array inherits
a shared, admin-editable default list from the singleton `vehicle_feature_defaults` table (id=1). This is
applied server-side inside `resolvePublicVehicle`/`resolvePublishedVehicles` (in `lib/vehicle-localization.ts`,
via a `defaultFeatureCodes` param) so every consumer of `/data/vehicles` gets consistent tags — never patch
this per-page on the client. Feature codes are restricted to a fixed catalog (`lib/vehicle-feature-catalog.ts`)
because freeform per-vehicle feature text never localized correctly outside Turkish; the admin UI is a
checkbox picker against that catalog, not a text input. **Why:** several vehicles had inconsistent or empty
amenity tags because there was no shared baseline — this "own data wins, else inherit shared default" pattern
is the general fix for that class of problem and should be reused for similar per-item-vs-shared-default needs.

## Grouped vs ungrouped rendering (added 2026-08-27)
`VehicleFleet` takes an independent `grouped` boolean prop (default `!homepageMode`) rather than overloading
`homepageMode` — the two are orthogonal (where it's placed vs. whether vehicle-class headings are shown). Only
the dedicated fleet page (`/araclar`) passes `grouped` explicitly true; all service-page call sites pass
`grouped={false}` to render one flat `CardCarouselStrip` with no class headings.
