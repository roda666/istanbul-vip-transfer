---
name: Service FAQ translation fallback
description: Rules for merging incomplete localized service FAQs with Turkish CMS source content.
---

When a localized service FAQ needs Turkish fallback text, match question and answer fields by the stable FAQ `id`, not by the item’s array position. Preserve the current Turkish source ordering, and omit locale-only entries whose source FAQ has been deleted.

**Why:** Translation rows can be stale, reordered, or retain a deleted FAQ. Positional merging can attach one question’s translation to another answer and generate incorrect public FAQ schema.

**How to apply:** Use the shared merge helper for public CMS reads. Any migration, seed, or translator that reconstructs FAQ arrays must preserve their stable IDs; cover reordered, incomplete, and orphaned rows in tests.