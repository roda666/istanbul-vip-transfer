---
name: Language catalog system
description: Durable invariants for the DB language catalog vs. public site exposure
---

- **Rule:** New catalog languages begin disabled and unpublished. They may receive AI/manual drafts, but publication requires complete, published title-and-body translations for every currently published CMS source. A missing custom UI dictionary safely uses English UI text; Turkish source text must never be used as a public fallback.
- **Why:** Static dictionary gating prevented valid future languages from being prepared, while permissive routing or partial translations could produce 404s or Turkish leakage. Completion-based publication keeps the language useful without exposing incomplete content.
- **How to apply:** Treat edge locale recognition as syntax-only, then let server layouts/routes check the catalog's enabled/published state. Any route or path helper must accept a syntactically valid catalog locale instead of the original fixed tuple. When redirecting a visitor off an inactive locale, also reset their language-preference cookie or middleware will loop them back.
- Passive languages may receive AI translation drafts in admin before activation; only public exposure is gated.
