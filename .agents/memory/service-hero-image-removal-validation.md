---
name: Service hero image removal validation
description: Publish-time rule for restoring an existing service page to its text-only gradient hero.
---

An already-published service may use the text-only gradient hero when its submitted hero image is null, including later edits after removal. A service that has never been published still requires a hero image to publish.

**Why:** Removing a mistaken upload must restore the established text-only hero option without accidentally weakening the service-specific hero-image requirement for first-time publication.

**How to apply:** Base the exception on published lifecycle state, not on whether the current database image is non-empty. Persist the paired hero ALT field as null whenever the resolved image is null. Keep a missing or empty hero image invalid for a first publish.