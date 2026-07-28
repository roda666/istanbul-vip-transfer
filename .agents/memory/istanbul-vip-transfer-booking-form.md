---
name: Istanbul VIP Transfer — Booking Form & Service Types
description: Architecture of the unified quote/reservation form, service types DB, provinces, and location scoping system.
---

## DB additions (migration 0002, already applied)

- `location_scope` enum: `LOCAL | INTERCITY | BOTH`
- `scope` column on `locations` table (default `LOCAL`)
- `service_types` table: key (stable, never deleted), label, description, enabled, quoteEnabled, reservationEnabled, displayOrder

## Seeds (already run)

- 4 service types: `AIRPORT_TRANSFER`, `INTERCITY`, `ALLOCATION`, `TOUR`
- 81 Turkish provinces: `type=PROVINCE`, `scope=INTERCITY`, slugs prefixed `il-` (e.g. `il-ankara`) to avoid collision with Istanbul district slugs

## Public API routes (all use /data/ prefix to avoid api-server conflict)

- `GET /data/locations?for=pickup|dropoff&scope=local|intercity` — scoped location list
- `GET /data/service-types` — enabled service types for the booking form

## Admin API routes

- `GET|POST /admin/api/locations` — includes scope in create payload
- `GET|PATCH|DELETE /admin/api/locations/[id]` — PATCH accepts scope; DELETE is two-phase (archive then permanent)
- `GET /admin/api/service-types` — list all (auth required)
- `PATCH /admin/api/service-types/[id]` — update label/description/toggles/order

## LocationCombobox

- `scope?: 'local' | 'intercity'` prop appended to fetch URL
- Used with `scope="local"` for airport/allocation/tour forms
- Used with `scope="intercity"` for intercity departure/arrival province pickers

## BookingForm

- Intent toggle: QUOTE (default) vs RESERVATION
- Service type selector cards from `/data/service-types`
- URL param `?hizmet=havaalani|sehirler-arasi|arac-tahsisi|tur` preselects service type on mount
- One react-hook-form, all service-specific fields optional; manual setError per service type in onSubmit
- Intercity: departure ≠ arrival province validation
- Round-trip: return date + time shown when yon=GIDIS_DONUS
- Submit opens WhatsApp with formatted message including "Talep Amacı: Fiyat Teklifi|Rezervasyon Talebi"

## Admin UI (ReservasyonAyarlariClient)

- 3 tabs: Lokasyonlar / Hizmet Türleri / Form Ayarları
- Lokasyonlar: scope filter column + scope field in add/edit modal
- Hizmet Türleri: inline edit for each of 4 service types (no add/delete)
- Form Ayarları: timeStepMinutes, exactAddressRequired, locationSearchEnabled

## Key constraints

- `/api/*` routes are claimed by api-server artifact — Next.js public data routes must use `/data/` prefix
- Province slugs must stay `il-` prefixed to avoid collisions
- Service types are seeded constants — admins edit, never delete
- `force-dynamic` on public data routes (simpler than revalidatePath for these)
