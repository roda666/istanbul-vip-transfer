---
name: Transactional email link origins
description: Safe, configurable public origins for all links embedded in transactional emails.
---

All transactional email links must use the centralized email-link origin resolver. Prefer the DB-managed public HTTPS site URL; only fall back to a validated reverse-proxy `x-forwarded-host`. Never use `request.url`, the normal Host header, a container bind address, `localhost`, loopback IPs, or ports.

**Why:** Next.js inside the container can see `0.0.0.0:26004`; embedding that origin produces links recipients cannot open.

**How to apply:** Reuse the central resolver for confirmation, unsubscribe, reset-password, and future email links. Force HTTPS and strip/reject ports. If no safe public origin exists, send the notification without a link and expose the missing-origin warning in Site Settings. Run the email-link safety test whenever link construction changes.

**Known gap (found 2026-08-26 pre-launch audit):** the resolver's host validator only rejects localhost/loopback/`0.0.0.0`; it does not reject non-production external hosts like a `.replit.dev` preview domain. If Site Settings' public site URL is ever left pointing at a dev/preview domain, every transactional email link will silently point there instead of the real production domain. Before any launch, verify Site Settings' public site URL is the real production domain, not just that it's "a valid HTTPS URL."