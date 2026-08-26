---
name: Service internal-links and starting-price system
description: How service-page related-links (service/blog/route/CTA) and computed starting-price badges are wired, plus a duplicate-component pitfall to check for before adding new related-content blocks.
---

## Internal links storage
`content.internal_links` (JSONB on the SERVICE content row) stores link items as
`{ href, label, anchor }` where `href` uses an abstract prefix resolved at render
time, not a locale-specific path: `service:<slug>`, `blog:<slug>`, `route:<slug>`,
`cta:quote`. Resolution lives in `lib/service-related-links.ts`
(`resolveInternalLinkHref` / `resolveServiceRelatedLinks`) and silently drops any
link whose target slug doesn't resolve — it must never render a broken link.

**Why:** storing a resolved path would be wrong for other locales and would go
stale if a target's URL scheme changes; the abstract prefix stays valid.

**How to apply:** extend this same prefix scheme for any future related-content
type rather than inventing a new link-storage convention.

## Duplicate related-content components
Before adding a new related-links/related-blog section to service pages, grep for
existing hardcoded ones. Three static route wrappers
(`app/istanbul-havalimani-transfer`, `app/sabiha-gokcen-havalimani-transfer`,
`app/vip-transfer`) plus the `[lang]/[...slug]` catch-all already rendered a
legacy `components/RelatedBlogSection.tsx` for TR locale on exactly those 3
slugs. Adding a new CMS-driven related-links block without checking caused a
duplicate "related blog" section on those 3 pages only.

**Why:** legacy hardcoded content blocks for a handful of pages are easy to miss
because they don't live in the generic renderer (`ServicePageRenderer.tsx`) —
they're bolted onto individual route files.

**How to apply:** the TR-only occurrences of `RelatedBlogSection` were removed
from the 3 static wrappers (superseded by the CMS-driven block); the
non-TR-locale usage in the catch-all page was left alone since the new
CMS-driven section is TR-only for now.

## Starting-price precedence
`lib/service-starting-price.ts` (`getServiceStartingPriceEur`) checks BOTH the
legacy `transfer_routes` EUR columns and the newer `route_price_rules` table
(active rows, EUR currency, validity window), takes the minimum across both,
rounds up to the nearest 5, and returns `null` (never fabricates) if no data
matches. The full quote engine (`vehicle_pricing_profiles` /
`admin-pricing-engine.ts`) is deliberately excluded from this computation —
it needs trip context and would risk showing a wrong "starting from" number.

## Header nav shared data source
`components/Header.tsx` desktop dropdown and mobile accordion both map over the
exact same `mainEntries` / `entry.groups` derived from one `getNav(...)` call —
there is no separate/stale list for mobile. If services are missing from one
menu variant, the bug is in the shared category/`show_in_nav` data, not in
Header.tsx duplicating logic. The mobile accordion is `{mobileServicesOpen &&...}`
conditional and only appears in raw curl'd SSR HTML after the client toggles it
open — its absence from a plain curl fetch is expected, not a bug.

## Booking-form anchor
The reliable, always-present anchor id for scrolling to the booking form on any
service page is `#rezervasyon` (the outer wrapper in
`CollapsibleBookingForm.tsx`) — `#collapsible-booking-form-content` only exists
in the DOM after the accordion is opened, so CTAs must target `#rezervasyon`.
