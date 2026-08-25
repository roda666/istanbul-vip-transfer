---
name: Brand wordmark assets
description: Durable rules for the public publisher logo, favicon family, and future real-logo image overlays.
---

Use the static wordmark assets as the sole source for publisher identity and any future greeting-sign logo overlay. The colored logo is intended for dark surfaces, while the white logo is the overlay-safe version. The vector wordmark contains outlined letter paths so it does not depend on client font availability.

**Why:** A schema URL that names a missing image weakens publisher identity, and asking an image model to draw a logo produces unreliable, artificial marks. Static, first-party assets preserve the actual brand appearance across crawlers, browser icons, and composited imagery.

**How to apply:** Keep publisher schema pointed at the public raster wordmark and keep the icon family visually aligned with it. For image composition, place the real white logo asset over a verified blank greeting sign; never include logo rendering in an AI prompt. Revalidate both direct asset responses and structured-data output whenever the logo files change.