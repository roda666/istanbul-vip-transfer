---
name: Language catalog system
description: Durable invariants for the DB language catalog vs. public site exposure
---

- **Rule:** A catalog language may only go public if the site can actually render it — its static UI dictionaries must exist. Enable-for-drafts and publish-to-public are separate states; publication of dictionary-less languages must stay blocked on the server, and every public surface (selector, sitemap, hreflang, locale switching) must derive its locale set from the single active-locales helper rather than any hardcoded list.
- **Why:** The catalog is far larger than the set of renderable languages; exposing a dictionary-less locale produces broken public pages.
- **How to apply:** When adding dictionaries for a new language, grow the renderable set in the same change that allows its publication. Edge middleware cannot query the database, so locale-state enforcement happens in server components/routes; when redirecting a visitor off an inactive locale, also reset their language-preference cookie or the static middleware will loop them back.
- Passive languages may receive AI translation drafts in admin before activation; only public exposure is gated.
