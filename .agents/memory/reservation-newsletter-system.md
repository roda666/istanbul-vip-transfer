---
name: Reservation + Newsletter system
description: DB tables, submit endpoint, admin modules, and i18n updates for the reservation request + newsletter consent feature.
---

## DB Tables
- `reservation_requests` — intent enum (QUOTE/RESERVATION), status enum (NEW→SPAM), requestData JSONB, referenceNumber unique
- `newsletter_subscribers` — status enum (PENDING/ACTIVE/UNSUBSCRIBED), normalizedEmail unique
- `newsletter_consent_events` — tracks GRANTED/WITHDRAWN with consentTextVersion
- `newsletter_tokens` — hashed, single-use, expiry-bound confirmation and unsubscribe tokens

## Submit endpoint: /data/submit-request
- Honeypot `_hp` field: non-empty → silent success (no DB write)
- Rate limit: 10 submissions/hour/IP (in-memory Map, separate from login limiter)
- Reference format: `IVT-YYYYMMDD-XXXXX` (stored in DB for admin only, never shown to customer)
- Newsletter: only written when checkbox checked AND email present; consent creates a `PENDING` subscriber and sends a double-opt-in confirmation message. Only the confirmation route can activate the subscriber; unsubscribed/suppressed addresses are never reactivated by a public form.
- Always saves intent as 'QUOTE' (intent selection removed from public form)
- On DB failure: request is lost silently — WA redirect already happened (fire-and-forget with keepalive:true)

## Admin modules
- `/admin/talepler` — list + detail + status/archive; uses `/admin/api/requests` (GET list) and `/admin/api/requests/[id]` (PATCH)
- `/admin/bulten-aboneleri` — list, unsubscribe, CSV export, and authenticated newsletter composition/send. Sends target `ACTIVE` subscribers only and every message carries a tokenized unsubscribe link.
- CSV only exports PENDING+ACTIVE subscribers (never UNSUBSCRIBED)
- All admin API routes check `session.isLoggedIn` and write to `auditLogs` on mutation

## Delivery rule

Newsletter and reservation emails use the central SMTP sender. When SMTP or notification recipients are missing, the public request is still saved and the admin-facing status records an actionable non-secret delivery outcome rather than treating mail as silently delivered.

**Why:** Marketing consent must be provable before sending, and an unsubscribe path must work without an admin intervention. Reservation persistence must not depend on a mail provider.

**How to apply:** Use hashed database tokens for confirmation/unsubscribe links, never include raw tokens in logs or persistence. Send marketing only to `ACTIVE` subscribers and always append the unsubscribe URL.

## i18n changes
Keys REMOVED: `flightNumber`, `direction`, `oneWay`, `roundTrip`, `returnDate`, `returnTime`, `flightPlaceholder`, `requiredReturnDate`, `waFlightNumber`, `waDirection`, `waOneWay`, `waRoundTrip`, `waDepartureDate`, `waDepartureTime`, `waReturnDate`, `waReturnTime`, `waNotes`, `notes`
Keys ADDED: `email`, `newsletterConsent`, `newsletterEmailRequired`, `minAllocationDuration`, `waEmail`, `waReference`
All 5 dict files (tr/en/de/ru/ar) updated in sync with types.ts.

**Why:** BookingForm never used i18n dict for its labels (hardcoded Turkish), so types.ts was the source of truth for structure; dict files must stay in exact sync or TypeScript excess-property errors fire.
