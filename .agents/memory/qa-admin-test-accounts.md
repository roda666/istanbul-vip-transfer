---
name: Temporary QA admin accounts for testing
description: How to get a working admin login for E2E testing when existing admin passwords are unknown, without touching real accounts.
---

When an E2E test (e.g. via the testing subagent) needs an authenticated admin session but no plaintext password is known for any existing admin account, do not reset an existing admin's password (that permanently locks out whoever owns it, since password hashing is one-way and the original can never be restored).

**Why:** Resetting a real admin's credential is a destructive, irreversible action on someone else's account. The project's `create-admin` bootstrap script also only runs when zero admins exist, so it can't be reused once real accounts are present.

**How to apply:** Insert a disposable admin row directly (distinct, clearly-named email like `qa-agent-temp@<domain>.local`, hashed password via the app's own `hashPassword`/bcrypt helper, minimum role needed for the test), run the test, then delete that row afterward. Never touch the password hash of a pre-existing account for testing purposes.
