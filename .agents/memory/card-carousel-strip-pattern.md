---
name: Card carousel "exactly N visible" pattern
description: Shared CardCarouselStrip component technique for guaranteeing an exact, never-clipped card count per breakpoint; plus a lazy-load testing gotcha.
---

`components/CardCarouselStrip.tsx` (Istanbul VIP Transfer) drives a horizontal card
strip where exactly N cards are fully visible at a time (never a partially clipped
card), with prev/next arrows flush at the far edges and vertically centered. It is
shared by the vehicles section and the popular-routes section.

**How it works:** a CSS custom property (`--ivt-strip-n`) set per breakpoint on a
wrapper class (`.ivt-card-strip`) drives each card's width as a CSS calc based on the
track width and gap, so the browser — not JS — guarantees exact card counts and no
mid-card clipping. Breakpoints: 1 card <480px, 2 at ≥480px, 3 at ≥900px, 4 at ≥1200px.
Arrow buttons scroll the track by one card width; ResizeObserver tracks scroll-state
for enabling/disabling arrows at the ends.

**Why:** a plain CSS grid or flex-wrap with fixed pixel widths reliably clips the last
visible card at in-between viewport widths; the calc-based width is the only approach
that stayed exact across every tested breakpoint (375/768/1280/1440).

**Lazy-load testing gotcha:** homepage sections wrapped in `DeferredVehicleFleet.tsx`
(IntersectionObserver-based lazy mount) will show zero matching elements in a
Playwright/E2E DOM check unless the test actually scrolls the section into view first
and waits — checking immediately after `page.goto` finds nothing and looks like a
missing-feature regression when it's actually just not mounted yet.
