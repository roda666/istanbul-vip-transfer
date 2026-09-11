---
name: Optional-service scope integrity
description: Canonical service-type scope policy for paid optional services.
---

An optional service must have a nonempty scope made of canonical service-type keys before it can be selected manually. An empty scope is invalid rather than meaning “available everywhere.” Use one pure scope helper for the admin selector, public listing, and server-side quote validation.

**Why:** Treating an empty scope as a wildcard in only one client exposed services that the quote engine correctly rejected, making a selected extra service appear to fail pricing. Consistent filtering prevents an impossible selection while server validation remains the bypass-resistant authority.

**How to apply:** When importing, creating, or editing a paid service, require the owner to choose supported service types explicitly. Do not broaden a service to other types without verified operating policy; scope changes affect eligibility, not its saved financial amount.