---
name: CMS publication and request provenance
description: Durable safety rules for service publication, social images, request-source reporting, and backup verification.
---

Service publication must invalidate every relevant localized detail route and the shared sitemap/chrome metadata surface. Social metadata may use only a verified, topic-specific reachable image; if verification fails, omit the image rather than substituting a shared/default asset.

**Why:** A newly published page must not serve stale search metadata, and a broken share image is worse than no image. Generic imagery weakens service relevance and creates inconsistent social previews.

**How to apply:** Validate proposed cover/OG assets server-side before publishing or persisting them. Keep image guidance explicit: no readable text, logos, emblems, signs, plates, or focused faces; people may appear only rear-facing, in profile, or distant.

Reservation provenance records a bounded, same-origin pathname and validated locale alongside the request. Database backup downloads must include a checksum and documented offline restore procedure.

**Why:** Operators need page/language attribution without storing query strings or visitor data, and a backup is only useful when its bytes can be verified before an offline restore.

**How to apply:** Derive page paths server-side from a sanitized Referer fallback; do not trust client identifiers. Verify archive bytes against the emitted SHA-256 manifest before following the restore guide.