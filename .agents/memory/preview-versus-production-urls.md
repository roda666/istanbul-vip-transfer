---
name: Preview versus production URLs
description: Rules for distinguishing Replit preview routes from a verified published deployment.
---

Never present a project’s configured site URL as proof that the current Replit artifact is live. Verify deployment metadata first; if no active deployment exists, report only the preview route/path and say that the production URL is unavailable.

**Why:** A configured or legacy custom domain can belong to an older site or an unrelated deployment. Replit preview checks do not establish that the current workspace has been published there.

**How to apply:** Use deployment metadata for `isDeployed` and the production URL. Describe browser checks as preview-only unless the exact production URL was explicitly fetched and verified.

Chatbot booking links must use the admin-managed central public-site setting exactly, including when that setting intentionally points to a Replit preview URL. Never replace it with a compile-time domain or request-derived host.

**Why:** During pre-launch, the preview app is the intended customer-test destination while the legacy custom domain still serves the old site. A compile-time fallback can silently send visitors to stale content.

**How to apply:** Normalize the configured HTTPS origin, append the localized booking path, and return no URL when the setting is unavailable. Surface preview-domain warnings in admin UI rather than silently substituting another domain.