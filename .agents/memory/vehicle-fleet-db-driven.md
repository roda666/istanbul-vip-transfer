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
