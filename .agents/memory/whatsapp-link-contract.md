---
name: WhatsApp link contract
description: Encoding, phone-format and mobile app-selection rules for every WhatsApp link in the product.
---

Every caller passes an unencoded plain-text message to one shared WhatsApp URL builder. The builder performs the only encoding step. Customer phone text inside messages is always `+` international format, while the `wa.me` recipient path contains digits only.

**Why:** Pre-encoding in an admin caller and encoding again in the shared opener exposed `%20`/`%2C` text in WhatsApp. WhatsApp's official universal-link format explicitly omits plus signs, punctuation and leading zeros from the URL path.

**How to apply:** New buttons must use the shared builder/opener and never call `encodeURIComponent` first. Keep `https://wa.me/` universal links; when Messenger and Business are both installed, website code cannot reliably choose between them because Android/iOS universal-link handling and user defaults select the app.