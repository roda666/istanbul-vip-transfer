---
name: Blog batch cache invalidation
description: Public blog cache handling after direct database writes by a server-side batch job.
---

Any direct database batch that changes published blog content must invalidate
the public blog data tag and paths through the app, using the purpose-scoped
signed revalidation endpoint. The batch job must never print the signature or
the secret used to create it.

**Why:** Next's cache invalidation APIs require a Next.js request context, so
calling them from a standalone script does not refresh the public page. Without
an application-context revalidation request, the database can be correct while
visitors still receive stale article content.

**How to apply:** After a successful direct update, submit only the changed
blog slugs to the signed internal revalidation endpoint, then verify the public
page in a fresh browser session. Do not attempt to call Next cache APIs directly
from the batch process.