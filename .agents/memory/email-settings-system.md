---
name: Email Settings System
description: AES-256-GCM SMTP password encryption, DB-driven email config, admin panel setup
---

## Key decisions

**Encryption**: SMTP passwords use a dedicated AES-256-GCM envelope-encryption path. On first use, the app generates a random data key and persists only its wrapped form in the `email_encryption_keys` singleton table. The wrapping key is derived from an existing Replit-managed app secret (`AUTH_SECRET`, with `SESSION_SECRET` fallback). An existing valid `EMAIL_ENCRYPTION_KEY` remains supported to read legacy SMTP passwords.

**Why:** Passwords and their data key must never appear in logs, source, or API responses. A random data key avoids asking the site owner to create a new secret, while envelope encryption means a database backup alone cannot recover the SMTP password.

**How to apply:** Keep the wrapped data key separate from `email_settings`; never return either ciphertext or wrapped-key material through an API. The first email-settings access may provision the key. If a legacy ciphertext cannot be read after its legacy secret is removed, ask the admin to enter a new SMTP password rather than attempting recovery.

**DB tables**: `email_settings` is the SMTP singleton (id=1). `email_encryption_keys` is the wrapped SMTP data-key singleton (id=1).

**Email priority**: `lib/email.ts` — DB row first (if `enabled=true` and host/user present), env var (`SMTP_HOST/USER/PASS/FROM`) fallback. Backward-compatible: health scheduler and existing callers work without DB config.

**Password API contract**: `GET` returns `passwordSet: boolean` — never the value. `PUT` with empty/omitted `smtpPass` keeps existing encrypted value; non-empty triggers re-encrypt.

**Admin page**: `/admin/e-posta-ayarlari` — server component checks `SUPER_ADMIN`, redirects others. Client component never pre-fills password field.

**Health scheduler**: Updated to call `getAdminNotifyEmails()` from `lib/email.ts` (DB → env fallback) instead of reading `process.env.ADMIN_EMAIL` directly.

**Rate limits (IP-keyed)**: `email-settings` 10/15min · `email-test-conn` 5/15min · `email-test-send` 5/15min (same `rateLimit()` from `lib/auth/rate-limit.ts`).

**Delivery evidence:** SMTP connection verification and server acceptance are distinct. A send is successful only when the recipient is explicitly accepted by the SMTP server; this proves handoff to SMTP, not mailbox delivery or an open/read receipt. Public form submissions persist independently of notification delivery, while admins can inspect the notification state.

**How to apply:** Any future email-sending feature should call `sendEmail()` from `lib/email.ts` — no need to read SMTP env vars directly. Use the detailed result only in protected server flows and expose categorical, non-secret evidence rather than raw SMTP responses. Admin notification recipients: call `getAdminNotifyEmails()`.
