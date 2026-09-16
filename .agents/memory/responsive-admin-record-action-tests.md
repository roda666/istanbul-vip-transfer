---
name: Responsive admin record-action tests
description: How acceptance tests must invoke shared admin record actions across mobile and tablet breakpoints.
---

At widths up to 480px, shared admin record actions are not direct buttons inside the record card. Tests must open the card's `İşlemler` trigger and select the action from the portaled dialog. At 481px and above, the action buttons remain inline in the card.

**Why:** A gate-pair acceptance test repeatedly failed while searching for `Düzenle` inside a visible mobile card. The card and action were valid; responsive rendering had moved the action into a portal outside the card DOM.

**How to apply:** In responsive admin acceptance tests, branch on the visible mobile `İşlemler` trigger (or viewport), then scope the action to the dialog. Do not assume that a visible record card contains its action buttons at every breakpoint.