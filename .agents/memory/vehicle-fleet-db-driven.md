---
name: Vehicle Fleet DB-driven system
description: VehicleFleet component is now DB-driven; 6 vehicles seeded with 9-lang translations; migration 0023 applied.
---

## Rule
`VehicleFleet` fetches `/data/vehicles?lang=` on mount and uses DB data if non-empty, falling back to static array.

**Why:** Admin needs to manage fleet without code changes. DB gives CMS-like control.

## Key types / helpers (in `components/VehicleFleet.tsx`)
- `FEATURE_ICON_MAP: Record<string, React.ElementType>` — maps string keys (`WIFI`, `CLIMATE`, `MEET_GREET`, `LEATHER`, `LUXURY`, `WATER`) to lucide-react components.
- `adaptDbVehicle(v: DbVehicle): DisplayVehicle` — converts DB row to the static vehicle shape the card renderer expects.
- State: `const [dbVehicles, setDbVehicles] = useState<DisplayVehicle[] | null>(null);` — null means "not yet loaded, use static"; empty array after fetch means "DB returned nothing, fall back to static".

## DB schema
`vehicles` table has `name_translations`, `short_desc_translations`, `tagline_translations` JSONB (migration 0023).
Public API at `app/data/vehicles/route.ts` returns `displayName`, `displayShortDesc`, `displayTagline` resolved from JSONB per `?lang=`.

## How to apply
Any future admin vehicle CRUD UI should POST/PATCH to a new `/admin/api/vehicles` route and invalidate the 60s cache on `GET /data/vehicles`. The VehicleFleet component will automatically pick up changes on the next page load.
