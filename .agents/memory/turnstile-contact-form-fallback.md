---
name: Turnstile contact-form fallback
description: Availability rules for Turnstile on the public contact form.
---

Turnstile is additive protection for the contact form, not an availability dependency. With no complete key pair, render no widget or loading state and allow normal submission. With a configured widget that fails or times out, stop waiting after a short bounded interval, record the degraded event, and allow submission through the independent server-side controls.

**Why:** A missing key, browser restriction, or Cloudflare outage previously left the submit button permanently disabled, preventing genuine customer messages.

**How to apply:** Require a token only while a configured widget is actively available. Treat a token older than four minutes as stale, reset the widget to obtain a fresh token, and accept a missing action field from siteverify while enforcing it when present. Keep rate limiting, both honeypots, signed minimum form age, input validation, and server-side Turnstile verification intact. Never make the transient loading copy a terminal UI state.