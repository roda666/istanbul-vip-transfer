---
name: Inline blog image batches
description: Safe persistence rule for batches that insert multiple Markdown images into one CMS article body.
---

When multiple generated images target the same article body, do not write each insertion from one body snapshot captured before the loop. Read the latest body for every insertion or build one merged body and update it once.

**Why:** Independent writes based on the same stale body replace earlier successful insertions, even though every image was generated and uploaded correctly.

**How to apply:** Treat the article body as a shared mutable record in batch jobs; verify all expected heading/image pairs after the batch completes.