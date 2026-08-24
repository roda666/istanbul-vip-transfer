---
name: Turnstile secret storage
description: Rules for safely persisting Cloudflare Turnstile secret keys.
---

Turnstile secret keys are envelope-encrypted with a generated persistent data key. The wrapping-key source has managed-secret fallbacks, but if no safe wrapping key or persistent key store is available, saving a secret must fail closed and explain the reason in Turkish.

**Why:** The settings UI must never confuse an authorization failure with unavailable encryption, and a database export must never contain a plaintext secret.

**How to apply:** Encrypt and round-trip validate before persistence; reload and decrypt-verify after persistence before reporting success. Public configuration responses may include only the site key and enabled/configured state, never the secret.