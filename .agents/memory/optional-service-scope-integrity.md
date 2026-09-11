---
name: Optional-service scope integrity
description: Canonical service-type scope policy for paid optional services.
---

An optional-service scope contains only canonical service-type keys. An empty scope is valid to save and means the service is hidden from every public reservation service type; it never means “available everywhere.” Use one scope rule for admin selection, public listing, and server-side quote validation.

**Why:** Treating an empty scope as a wildcard exposed services that the quote engine rejected. The owner explicitly chose empty scope as a deliberate public-hidden state while retaining strict rejection of unknown keys.

**How to apply:** Show real service_types as a multi-select, preserve existing selections, allow zero selections, and filter empty-scope services out of every public form and quote path. Scope changes affect eligibility, not saved financial amounts.