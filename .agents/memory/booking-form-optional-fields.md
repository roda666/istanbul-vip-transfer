---
name: Booking form optional field visibility
description: Admin can toggle 4 optional booking fields; public form fetches visibility from /data/form-settings.
---

## Rule
Optional fields (Bagaj Sayısı, Çocuk Koltuğu, Araç Tercihi, Ek Notlar) are off by default. Admin toggles them at `/admin/rezervasyon-ayarlari` → Form Ayarları tab.

**Why:** Not all bookings need these fields; showing them by default adds noise. Admin controls visibility.

## Implementation
- DB: 4 boolean columns on `site_settings` (migration 0021): `show_luggage_count`, `show_child_seat_count`, `show_vehicle_preference`, `show_additional_notes`.
- Public API: `GET /data/form-settings` (no auth, 60s cache) returns the 4 booleans.
- `BookingForm.tsx`: fetches `/data/form-settings` on mount, stores as `formSettings` state. Optional Panel renders between Panel A and Panel B when any field is enabled.
- WA message: `waSuffix` appends optional fields to the WhatsApp URL only when enabled AND filled.
- Admin: `_ReservasyonAyarlariClient.tsx` → FormSettings interface has the 4 new booleans; 4 Toggle components in form-ayarlari tab after "Kesin Adres Zorunlu" toggle.

## How to apply
Any new optional booking field follows the same pattern: add boolean to `site_settings`, add to `/admin/api/reservation-settings` schema, fetch via `/data/form-settings`, conditionally render in `BookingForm.tsx`.
