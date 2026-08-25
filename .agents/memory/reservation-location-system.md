---
name: Reservation Location System
description: Architecture decisions and quirks for the admin-managed location + booking form system.
---

# Reservation Location System

## Public locations API — path routing conflict
The Replit proxy assigns `/api/*` to the `api-server` artifact (paths = ["/api"] in its artifact.toml). Next.js `app/api/...` routes are unreachable from the browser for that prefix.

**Rule:** Public (no-auth) endpoints that the Next.js app serves must NOT use `/api/` prefix. Use `/data/`, `/public/`, or any other prefix.

The public locations endpoint lives at:
- `artifacts/istanbul-vip-transfer/app/data/locations/route.ts` → served at `/data/locations?for=pickup|dropoff`

LocationCombobox fetches from `/data/locations?for=...` — keep this in sync.

## Migration strategy (no DATABASE_URL in available secrets)
`drizzle-kit generate` requires DATABASE_URL in the env (the config throws at startup). But DATABASE_URL IS available at runtime (it's a Replit-managed secret). `drizzle-kit migrate` works fine.

For manually-written migrations: write the `.sql` file + update `_journal.json`, then run `drizzle-kit migrate`. The migrate command ran successfully even for the manually-created `0001_locations_and_settings.sql`.

If unsure whether migration ran, write an idempotent `db/apply-migration.ts` using `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`, run it with `npx tsx`, then delete it.

## Seed file
`db/seed-locations.ts` — idempotent via `ON CONFLICT (slug) DO NOTHING`. Run with `npx tsx db/seed-locations.ts`. Seeded 41 locations: 2 airports (IST, SAW) + 39 Istanbul districts.

## LocationCombobox
- `components/LocationCombobox.tsx` — fetches `/data/locations?for=pickup|dropoff`, groups by TYPE_ORDER, Turkish-normalized search, keyboard navigable.
- `excludeName` prop prevents selecting the same location for both pickup and dropoff.
- BookingForm uses `react-hook-form Controller` to integrate the combobox.

## Mobile location search

Location choices are search-on-demand: never preload the catalog, keep non-Istanbul choices at province level, and show only the plain place name. On mobile the result list is a fixed, internally scrollable panel positioned above the visual viewport keyboard.

**Why:** A card-relative dropdown can be hidden behind the mobile keyboard and a preloaded catalog delays the booking path. CSS `content-visibility` creates a containing block that breaks fixed positioning for this panel.

**How to apply:** Keep interactive booking sections outside deferred render containment. Query the public locations endpoint only after a search term exists; the endpoint must enforce Istanbul-only local districts and province-only intercity choices.

## Time selection
`saatSaat` (HH select, 00-23) + `saatDakika` (MM select, 00/05/.../55) combined to HH:mm in onSubmit. Zod validates minute % 5 === 0.
