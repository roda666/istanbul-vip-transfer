---
name: Turnstile form scope
description: Product decision for Cloudflare Turnstile across public forms.
---

Cloudflare Turnstile is enabled by default for the public contact form, while the reservation form is disabled by default and may only be enabled deliberately from the security settings page.

**Why:** The reservation flow opens WhatsApp from a user gesture and must remain free of widget loading, token acquisition, or verification waits that could interfere with that popup. The site owner specifically requested protection for the contact form.

**How to apply:** Do not render a widget, fetch public Turnstile configuration, or require a Turnstile token on reservations while its scoped toggle is off. Keep reservation's independent server-side protections (rate limiting, honeypots, and signed minimum-time ticket) active in all cases.