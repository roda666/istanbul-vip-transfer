---
name: GSC refresh-token failure states
description: How to distinguish revoked/invalid Google OAuth grants from transient Search Console refresh failures.
---

Treat OAuth token endpoint `invalid_grant` and `invalid_client` responses as a durable reconnect-required state. Keep network failures and unclassified provider failures retryable.

**Why:** A stored refresh token can remain present after Google revokes or invalidates it. If the database still says “connected,” Search Console data silently disappears while the settings screen incorrectly reports a healthy connection.

**How to apply:** Persist only a safe state code, mark the connection inactive when reauthorization is required, and show a reconnect action. Never return or log token endpoint bodies, access tokens, refresh tokens, client IDs, or client secrets.