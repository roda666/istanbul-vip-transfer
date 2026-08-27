---
name: Istanbul VIP Transfer overflow-guard regression suite
description: Permanent Playwright suite guarding against horizontal-overflow regressions; how to run it without timing out in dev mode.
---

`artifacts/istanbul-vip-transfer/tests/overflow-guard.spec.ts` is a permanent regression
check (registered as validation command `overflow-guard`) asserting
`document.body.scrollWidth` / `document.documentElement.scrollWidth` never exceed
`window.innerWidth` across mobile/tablet/desktop/wide viewports, on one representative
page per template (home, a service page, `/araclar`, a blog post, a route detail page).
Blog/route slugs are looked up live from `/sitemap.xml` so it stays valid as content changes.

**Why:** horizontal overflow bugs on this site have repeatedly come from a single
offending element (fixed-width grid column, negative-offset honeypot, non-collapsing
`repeat(N, minmax(...))` grid) that's easy to reintroduce and easy to miss visually on
just one breakpoint.

**How to apply:** run this whenever layout-affecting CSS/component changes are made
(cards, grids, headers, new sections). Two operational quirks:
- The `startValidationRun`/validation-skill runner has a poll budget that is too short
  for the full suite in Next.js **dev mode** (first hit per route triggers on-demand
  compilation, which can push total runtime past ~10 minutes). Prefer running via plain
  `npx playwright test tests/overflow-guard.spec.ts --grep "<width-group>"` directly in
  ShellExec, split by width group (mobile/tablet/desktop/wide), each comfortably under
  the 5-minute ShellExec timeout.
  - a foreground shell call, not `&`-backgrounded (see the ShellExec-background-lifecycle
    memory — backgrounded playwright runs die when the call returns).
  - `curl`-warming each target path once before the run avoids the first-hit compile
    delay causing a flaky `waitForLoadState('networkidle')` timeout on cold routes.
