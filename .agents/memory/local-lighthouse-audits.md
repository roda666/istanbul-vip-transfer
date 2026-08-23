---
name: Deterministic performance work
description: The performance implementation and non-measurement policy for this workspace.
---

# Deterministic performance work

Do not run performance measurement tools in this workspace, including local
Lighthouse, PageSpeed Insights, or external performance APIs.

**Why:** audit runs have caused connection failures, avoidable cost, and delay;
their failure does not establish an application regression.

**How to apply:** Apply known deterministic improvements directly: optimized
Next.js images, correct hero priority and lower-page lazy loading, stable image
dimensions, optimized generated media, bounded data reads, mandatory alt text,
adequate contrast, clean console output, safe external-link attributes, and a
single non-skipping heading hierarchy. Do not report performance scores. If an
issue cannot be diagnosed without measurement, surface that uncertainty instead
of making speculative changes.