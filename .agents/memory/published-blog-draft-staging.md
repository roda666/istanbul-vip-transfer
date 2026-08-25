---
name: Published blog draft staging
description: How published blog posts keep public content stable while an editor prepares a replacement draft.
---

Published blog changes must be staged rather than written into the live content fields. The pending body lives in the existing draft field and the matching CMS metadata lives in the latest pending-draft revision snapshot; the admin read model overlays those staged values only for editors.

**Why:** Updating a live record field-by-field exposes incomplete articles, changed SEO metadata, or a removed cover image before editorial work is complete. The original public content and its publication date must remain stable until an explicit later publish action.

**How to apply:** For an already published post, save the body and all changed blog fields as a draft snapshot, leave the live fields and `publishedAt` untouched, and do not change translation states merely because a draft exists. Ensure the admin editor visibly identifies the pending draft and uses it as its working state.