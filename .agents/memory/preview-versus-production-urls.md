---
name: Preview versus production URLs
description: Rules for distinguishing Replit preview routes from a verified published deployment.
---

Never present a project’s configured site URL as proof that the current Replit artifact is live. Verify deployment metadata first; if no active deployment exists, report only the preview route/path and say that the production URL is unavailable.

**Why:** A configured or legacy custom domain can belong to an older site or an unrelated deployment. Replit preview checks do not establish that the current workspace has been published there.

**How to apply:** Use deployment metadata for `isDeployed` and the production URL. Describe browser checks as preview-only unless the exact production URL was explicitly fetched and verified.