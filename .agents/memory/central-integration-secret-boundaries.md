---
name: Central integration secret boundaries
description: Security boundaries for the centralized admin credential store.
---

Application API credentials may use an envelope-encrypted DB override with environment fallback. Session/database/encryption roots must remain environment-managed because storing the key that unlocks the database inside that same database creates a circular trust dependency.

OAuth access, refresh and bearer tokens remain in provider-specific encrypted connection stores, with only connection status shown centrally. Trusted AI proxy base URLs are environment-only and cannot be edited in the admin panel.

**Why:** A generic token editor duplicates provider lifecycle state, while an editable provider base URL can redirect authenticated requests and API keys to an attacker-controlled or internal endpoint.

**How to apply:** Add only long-lived application credentials to the central editable allowlist. Keep roots, OAuth tokens and trusted infrastructure endpoints read-only/status-only, and reject them at the API allowlist boundary.