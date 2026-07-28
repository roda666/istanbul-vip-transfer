---
name: Reservation + Newsletter system
description: DB tables, submit endpoint, admin modules, and i18n updates for the reservation request + newsletter consent feature.
---

## DB Tables (migration 0004)
- `reservation_requests` — intent enum (QUOTE/RESERVATION), status enum (NEW→SPAM), requestData JSONB, referenceNumber unique
- `newsletter_subscribers` — status enum (PENDING/ACTIVE/UNSUBSCRIBED), normalizedEmail unique
- `newsletter_consent_events` — tracks GRANTED/WITHDRAWN with consentTextVersion

## Submit endpoint: /data/submit-request
- Honeypot `_hp` field: non-empty → silent success (no DB write)
- Rate limit: 10 submissions/hour/IP (in-memory Map, separate from login limiter)
- Reference format: `IVT-YYYYMMDD-XXXXX` (stored in DB for admin only, never shown to customer)
- Newsletter: only written when checkbox checked AND email present; repeated submissions upsert; consent version `2026-07-28-v1`
- Always saves intent as 'QUOTE' (intent selection removed from public form)
- On DB failure: request is lost silently — WA redirect already happened (fire-and-forget with keepalive:true)

## Admin modules
- `/admin/talepler` — list + detail + status/archive; uses `/admin/api/requests` (GET list) and `/admin/api/requests/[id]` (PATCH)
- `/admin/bulten-aboneleri` — list + unsubscribe + CSV export; uses `/admin/api/newsletter` (GET list), `/admin/api/newsletter/[id]` (PATCH), `/admin/api/newsletter-export` (GET CSV, BOM-prefixed for Excel)
- CSV only exports PENDING+ACTIVE subscribers (never UNSUBSCRIBED)
- All admin API routes check `session.isLoggedIn` and write to `auditLogs` on mutation

## i18n changes
Keys REMOVED: `flightNumber`, `direction`, `oneWay`, `roundTrip`, `returnDate`, `returnTime`, `flightPlaceholder`, `requiredReturnDate`, `waFlightNumber`, `waDirection`, `waOneWay`, `waRoundTrip`, `waDepartureDate`, `waDepartureTime`, `waReturnDate`, `waReturnTime`, `waNotes`, `notes`
Keys ADDED: `email`, `newsletterConsent`, `newsletterEmailRequired`, `minAllocationDuration`, `waEmail`, `waReference`
All 5 dict files (tr/en/de/ru/ar) updated in sync with types.ts.

**Why:** BookingForm never used i18n dict for its labels (hardcoded Turkish), so types.ts was the source of truth for structure; dict files must stay in exact sync or TypeScript excess-property errors fire.
