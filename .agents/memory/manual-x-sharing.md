---
name: Manual X and Facebook sharing
description: Token-free editorial web sharing alongside the existing social API connections.
---

Editorial users need reliable manual X and Facebook sharing routes even when a
provider API or OAuth connection is unavailable. Use X's official web intent
with a URL-encoded title, summary, and canonical public URL. Use Facebook's
official sharer with the canonical public URL; it reads the page's Open Graph
metadata. Keep both options independent from automatic social publishing.

**Why:** Manual sharing uses the editor's already-authenticated social session
and does not need credentials, API access, or a server-side publish request.
It is an operational fallback, not a replacement for automation.

**How to apply:** Generate share URLs only from public content URLs—never
admin, preview, or temporary development URLs—and only enable an editorial
share action for content that is published. Do not disable, remove, or couple
the existing API/OAuth publishing flow to this convenience action.