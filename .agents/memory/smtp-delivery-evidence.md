---
name: SMTP delivery evidence
description: Rules for reporting and retaining transactional email delivery outcomes.
---

Treat an email as sent only when the SMTP server explicitly accepts the intended recipient. A saved contact or booking request is a separate outcome and must never imply that its notification was delivered.

**Why:** Connection/authentication may succeed while the sender is unauthorized, the recipient is rejected, or the SMTP transaction never receives an acceptance response.

**How to apply:** Record every send attempt with its source, recipient, result code, acceptance counts, message ID, and capped/redacted provider response; never store credentials or message bodies. In the admin UI, show this evidence and distinguish connection, authentication, recipient, sender-domain, and unconfirmed-acceptance failures. Reject a configured sender whose domain does not match the authenticated SMTP domain when it can be determined.