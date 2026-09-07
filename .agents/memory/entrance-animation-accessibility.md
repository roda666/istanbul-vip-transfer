---
name: Entrance animations and accessibility audits
description: Why performance-driven motion removal must be followed by a fresh accessibility audit.
---

Viewport entrance animations that begin at zero opacity can cause automated accessibility tools to skip content that is visually hidden at audit time. Removing those animations may correctly reveal pre-existing contrast failures even when the underlying colors did not change.

**Why:** A public performance cleanup removed opacity-based motion wrappers and reduced unused JavaScript, but the next Lighthouse run exposed low-contrast text that the animated version had hidden from the audit.

**How to apply:** After replacing or removing entrance motion, rerun accessibility checks on the now-immediately-visible content. Treat newly exposed contrast failures as real defects, not as a reason to restore opacity-based animation.