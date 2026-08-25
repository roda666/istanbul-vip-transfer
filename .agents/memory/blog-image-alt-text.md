---
name: Blog image alt text
description: Why visual alt text uses its own safe normalizer rather than the public toll-copy filter.
---

Blog cover alt text must preserve accurate visual and geographic descriptions, even when they include terms that are restricted in customer-facing route or pricing prose.

**Why:** Applying the toll/route copy filter to an image alt can remove the entire description and force an unrelated article-title fallback, harming accessibility and breaking editorially specified alt text.

**How to apply:** Use the dedicated image-alt normalizer for blog hero and translated-source image alts. Keep the toll-copy filter for prose and pricing/route fields only.