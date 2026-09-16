---
name: Customer-content CMS standard
description: Durable translation and admin-list rules for customer-visible CMS records.
---

Customer-visible CMS records use one shared admin card, nine language badges, and a consistent action order. A published Turkish source creates a durable, source-hash-deduplicated job for EN, DE, RU, AR, ES, FR, IT and NL. Provider calls never block the source save request.

**Why:** Long synchronous translation saves failed unpredictably, duplicated work, and could hide the last valid localized copy. Independent list implementations also drifted on mobile actions, status labels and deletion behavior.

**How to apply:** Keep the last valid localized payload public as OUTDATED until its validated replacement is ready. A failed replacement must not blank or mark the old payload FAILED. New customer-content types need an adapter into the common queue, card, language-status and dependency-aware delete contracts.