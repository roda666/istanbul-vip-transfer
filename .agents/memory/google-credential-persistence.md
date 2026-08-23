---
name: Google credential persistence
description: Safety and data-use rules for Google Search Console and Ads connections.
---

Never interpolate OAuth access tokens, refresh tokens, or expiry values into SQL text. Use the ORM or a parameterized query for every credential write, including refresh flows and OAuth callbacks.

**Why:** Raw credential interpolation can expose secrets through logs and can break or alter SQL when token content includes a quote.

**How to apply:** Keep tokens server-only and return only public connection metadata. Reuse the canonical Search Console opportunity logic when grounding content decisions, and use page-dimension analytics for traffic-led legacy URL migration analysis.