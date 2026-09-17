---
name: Service hero image removal validation
description: Publish-time rule for restoring an existing service page to its text-only gradient hero.
---

An already-published service may use the text-only gradient hero when its submitted hero image is null, including later edits after removal. A service that has never been published still requires a hero image to publish.

Public metadata generation must never enforce this admin publication rule by throwing. If a CMS-created service slug has no registered service-specific OG/hero asset, use the global branded OG card (or omit the image metadata) and let the public page render. Keep the missing/unreachable image visible as an admin warning instead.

**Why:** Removing a mistaken upload must restore the established text-only hero option without accidentally weakening the service-specific hero-image requirement for first-time publication. A registry mismatch once allowed metadata generation to crash an otherwise published public service page; editorial incompleteness must not become visitor-facing downtime.

**How to apply:** Base the admin exception on published lifecycle state, not on whether the current database image is non-empty. Persist the paired hero ALT field as null whenever the resolved image is null. Keep a missing or empty hero image invalid for a first publish, but make all public render/metadata readers defensive and non-throwing.