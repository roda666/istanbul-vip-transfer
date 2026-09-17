---
name: Responsive admin record-action tests
description: How acceptance tests must invoke shared admin record actions across mobile and tablet breakpoints.
---

At widths up to 480px, shared admin record actions are not direct buttons inside the record card. Tests must open the card's `İşlemler` trigger and select the action from the portaled dialog. At 481px and above, the action buttons remain inline in the card.

At inline widths, using the shared component is not enough to prove visual consistency. The action strip must not wrap; acceptance must measure that every visible action has the same vertical coordinate. A narrow parent or local `flex-wrap` override can otherwise recreate the old two-row layout while component/order assertions still pass.

**Why:** A gate-pair acceptance test repeatedly failed while searching for `Düzenle` inside a visible mobile card. Separately, vehicle actions used the shared component but wrapped into two rows because both the shared desktop strip and a local responsive override allowed wrapping; earlier structural tests falsely reported consistency.

**How to apply:** In responsive admin acceptance tests, branch on the visible mobile `İşlemler` trigger (or viewport), then scope the action to the dialog. For inline actions, assert one shared container, canonical action order, and one-row geometry. Fresh preview evidence must use a new browser context, no-cache navigation, and a run-specific output directory; do not infer provenance from old deterministic filenames.