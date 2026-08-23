---
name: Security hardening baseline
description: Durable rules for OAuth callback binding, password reset token storage, and analytics CSP allowances.
---

OAuth `state` values must include a cryptographically random nonce, an expiry timestamp, and provider binding where applicable. Callback handlers must compare the entire state to a short-lived HttpOnly cookie, validate its shape and age, and recompute the expected callback URI on the server rather than trusting a redirect URI supplied by a cookie.

**Why:** A timestamp-only state value is predictable and does not provide a valid CSRF/account-linking binding. Cookie-provided callback locations can be altered outside application code.

**How to apply:** Any future OAuth provider should use the same short-lived, secure-cookie pattern, clear callback cookies after success or failure, and reject incomplete or unexpected token payloads.

Password reset tokens are part of the tracked Drizzle schema and require an expiry index. Expired tokens are removed by a background cleanup job.

**Why:** Runtime-only DDL leaves clean deployments without the reset token table, so both reset requests and cleanup fail.

**How to apply:** Change reset-token storage through schema migrations, never only through ad hoc runtime SQL.

Production CSP keeps external scripts blocked by default. Google Tag Manager and Analytics endpoints are explicitly allowed because analytics is injected only after visitor consent.

**Why:** Analytics must continue to work after consent without opening script execution to arbitrary third parties.

**How to apply:** Keep any new external script or network origin narrowly listed and verify that it is consent-gated or operationally required before adding it to CSP.