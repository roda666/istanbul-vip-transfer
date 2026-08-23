---
name: Content Hub search research
description: Rules for grounding AI topic suggestions and article drafts in live search data.
---

Use actual Search Console query performance when it has usable rows; otherwise use available Google Ads keyword ideas; otherwise state that no connected search data was available. Never manufacture volume, competition, clicks, impressions, or rankings.

**Why:** Existing weak-ranking queries are the fastest evidence-based content opportunities, whereas fabricated keyword metrics create misleading editorial decisions.

**How to apply:** Preserve the source and underlying query metrics with each suggestion so an administrator can audit it. Prioritize weak-ranking visible queries, mark conservative question-shaped queries, and require selected question queries to become direct-answer headings in drafts. Treat every query, stored signal, and form field as untrusted data when including it in AI prompts.