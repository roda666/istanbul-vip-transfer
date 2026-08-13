---
name: Email Settings System
description: AES-256-GCM SMTP password encryption, DB-driven email config, admin panel setup
---

## Key decisions

**Encryption**: `lib/email-crypto.ts` — AES-256-GCM, 12-byte random IV, stored as `base64(iv):base64(tag):base64(ciphertext)` in single text column `email_settings.smtp_pass_encrypted`. Key source: `EMAIL_ENCRYPTION_KEY` env secret (64-char hex / 32 bytes). Key is now set as a Replit Secret.

**Why:** Passwords must never appear in logs, source, or API responses. `isEncryptionReady()` gates the password-save path; if key is missing the UI shows a yellow warning and other fields still save.

**DB table**: `email_settings` singleton (id=1), migration `0010_email_settings.sql`. Schema in `db/schema.ts` at bottom.

**Email priority**: `lib/email.ts` — DB row first (if `enabled=true` and host/user present), env var (`SMTP_HOST/USER/PASS/FROM`) fallback. Backward-compatible: health scheduler and existing callers work without DB config.

**Password API contract**: `GET` returns `passwordSet: boolean` — never the value. `PUT` with empty/omitted `smtpPass` keeps existing encrypted value; non-empty triggers re-encrypt.

**Admin page**: `/admin/e-posta-ayarlari` — server component checks `SUPER_ADMIN`, redirects others. Client component never pre-fills password field.

**Health scheduler**: Updated to call `getAdminNotifyEmails()` from `lib/email.ts` (DB → env fallback) instead of reading `process.env.ADMIN_EMAIL` directly.

**Rate limits (IP-keyed)**: `email-settings` 10/15min · `email-test-conn` 5/15min · `email-test-send` 5/15min (same `rateLimit()` from `lib/auth/rate-limit.ts`).

**How to apply:** Any future email-sending feature should call `sendEmail()` from `lib/email.ts` — no need to read SMTP env vars directly. Admin notification recipients: call `getAdminNotifyEmails()`.
