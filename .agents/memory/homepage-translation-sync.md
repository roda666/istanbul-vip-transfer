---
name: Homepage Translation Sync
description: Automatic multilingual synchronization for homepage CMS — field classification, AI translation pipeline, manual lock, status states.
---

## Source-save behavior

Turkish is the canonical homepage source. Every Turkish source save must keep EN/DE/RU/AR/FR/ES/IT/NL synchronized and publish source-triggered translations; clients cannot opt out with request flags. Manual single-locale retries remain draft-only, while an unavailable AI provider leaves work safely queued.

## Concurrent source saves

Only one provider request may own a locale at once. A later Turkish source save waits for
the active row to complete, then either observes its own source hash as current or claims
an eligible FAILED/OUTDATED row. The active worker rechecks the canonical source after
each provider response and retries against the newest revision when necessary.

**Why:** A unique translation row prevents duplicates but does not, on its own, prevent
two requests from sending duplicate AI calls or an older result from overwriting a newer
Turkish save.

**How to apply:** Keep terminal updates conditional on both the translation claim and the
exact canonical source revision. Any new homepage translation path must use the same
single-owner/recheck pattern rather than a read-then-unconditional-update flow.

## Shared asset rendering

Hero image paths are shared source-owned fields, not locale-specific translation content.
Public non-Turkish homepage rendering must overlay shared fields from the published Turkish
source onto the translated body before display.

**Why:** A previously published translation body can retain an old asset path if a
background synchronization is delayed or a translation is protected, causing different hero
images across locales even though the asset is intentionally shared.

**How to apply:** Keep translated hero alt text locale-specific, but derive `hero.imagePath`
and all other shared fields through `syncSharedFields` at public read time. Persisting the
same synchronization remains desirable, but public consistency must not depend on it.
