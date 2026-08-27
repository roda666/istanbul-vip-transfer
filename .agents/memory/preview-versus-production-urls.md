---
name: Preview versus production URLs
description: Rules for distinguishing Replit preview routes from a verified published deployment.
---

Never present a project’s configured site URL as proof that the current Replit artifact is live. Verify deployment metadata first; if no active deployment exists, report only the preview route/path and say that the production URL is unavailable.

**Why:** A configured or legacy custom domain can belong to an older site or an unrelated deployment. Replit preview checks do not establish that the current workspace has been published there.

**How to apply:** Use deployment metadata for `isDeployed` and the production URL. Describe browser checks as preview-only unless the exact production URL was explicitly fetched and verified.

Customer-facing links must also reject Replit preview domains even when a preview URL was accidentally saved in the central public-site setting. Prefer a non-preview central setting; otherwise use the product’s shared verified site URL rather than the request host.

**Why:** Development-origin auto-detection can persist a temporary preview hostname in an otherwise authoritative setting, causing chat and transactional messages to expose an unstable URL.

**How to apply:** Validate both detected and configured origins before composing public links. Domain changes should still be made through the central public-site setting, which takes precedence once it contains a non-preview HTTPS origin.