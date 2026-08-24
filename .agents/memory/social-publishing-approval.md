---
name: Social publishing approval
description: Safety and provenance rules for AI content automation, social publishing, Keyword Planner research, and review synchronization.
---

Automated AI research, drafts, images, schedules, and social publication must be review-gated by default. The account owner may explicitly disable that gate, but a normal administrator may not weaken it.

**Why:** Automation should accelerate editorial work, not silently publish material the owner has not approved.

**How to apply:** Any edit to previously approved or scheduled material revokes approval and requires a fresh review. Enforce the rule server-side for every publish path, not only in UI controls.

Search-volume metrics and competitor-gap results must only come from an available, attributable provider. When Google Ads, Search Console, or a competitor analysis source is unavailable, show a safe unavailable state instead of estimates dressed as data.

**Why:** Editorial choices and spending decisions need trustworthy provenance.

**How to apply:** Return provider labels, exact-match/no-result states, and connection guidance. Do not persist provider error bodies or invent metrics/topics.

Social test posts and Google Business review syncs use the actual connected provider result. Instagram assets are refused unless they are public, validated, topic-specific images within platform aspect limits and without unsafe visual content.

**Why:** A successful UI message must correspond to accepted remote publication, while brand-safety rules cannot be inferred from arbitrary uploads.

**How to apply:** Record safe acceptance metadata and audit outcomes; schedule review synchronization only for connected, enabled accounts and clearly display disconnected/disabled state.