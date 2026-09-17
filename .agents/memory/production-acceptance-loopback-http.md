---
name: Production acceptance over loopback HTTP
description: Environment-specific authentication and CSRF rules for production-build acceptance tests on local HTTP.
---

The canonical production-build acceptance runner serves Next.js on loopback HTTP. It may disable the Secure flag only behind a runner-owned environment marker; deployed production cookies must remain Secure. Programmatic mutation requests must include an Origin header matching the exact loopback scheme, host and port.

**Why:** A Secure production cookie is not sent over loopback HTTP, causing protected APIs to return 401 even after login. Once authenticated, APIRequestContext mutations without Origin are correctly rejected by CSRF middleware with 403.

**How to apply:** Keep the exception scoped to the acceptance runner. Reuse its authenticated BrowserContext request jar, use one exact IPv4 origin, and send that origin on POST/PUT/PATCH/DELETE requests.