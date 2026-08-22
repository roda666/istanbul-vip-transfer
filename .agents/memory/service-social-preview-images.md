---
name: Service social preview images
description: Service-page Open Graph image rules across Turkish and localized routes.
---

Every registered service must use its matching `/hero-images/<service-slug>.jpg` file for Open Graph and Twitter preview metadata, both on Turkish static routes and locale-prefixed dynamic routes.

**Why:** CMS `og_image` values can be blank or accidentally shared, causing unrelated services to produce identical social previews. The public hero-image set has one verified, distinct asset for every registered service.

**How to apply:** Use the shared service social-image helper whenever rendering service metadata. The mapping must cover exactly the service registry and should be tested for public-asset presence; non-service pages may continue using the site-wide default image.