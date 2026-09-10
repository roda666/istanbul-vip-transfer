---
name: Responsive change validation
description: Owner-required mobile and tablet acceptance checks for every UI change.
---

Every UI feature or edit must be verified at both mobile and tablet widths before delivery. The page itself must not overflow horizontally; local strips such as tab bars may scroll inside their own bounded container. Primary controls and interactive rows must provide at least 44px touch height, and multi-column forms must collapse when their content would become cramped.

**Why:** The owner made this a general project rule after pricing-admin changes were initially validated only on desktop.

**How to apply:** Include representative mobile and tablet viewport checks in the same verification pass as desktop. Measure document width versus viewport, inspect stacking, and measure important buttons/selects rather than relying only on a screenshot.