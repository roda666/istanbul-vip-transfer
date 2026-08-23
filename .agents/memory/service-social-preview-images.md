---
name: Service social preview images
description: Service-page Open Graph image rules across Turkish and localized routes.
---

Every registered service must use a matching branded `/images/og/og-<service-slug>.jpg` card for Open Graph and Twitter preview metadata, both on Turkish static routes and locale-prefixed dynamic routes. The hero source stays at `/hero-images/<service-slug>.jpg`.

**Why:** CMS `og_image` values can be blank or accidentally shared, causing unrelated services to produce identical social previews. The public hero-image set has one verified, distinct asset for every registered service; the card generator turns each into a consistent 1200×630 social asset.

**How to apply:** Use the shared OG-image helper whenever rendering service metadata. The registry and card map must stay in lockstep and be tested for public-asset presence. An unknown service must fail explicitly rather than silently returning the site-wide card; non-service pages may continue using the site-wide default image.