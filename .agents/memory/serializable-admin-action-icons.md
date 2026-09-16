---
name: Serializable admin action icons
description: Safe icon API convention for shared admin Client Components rendered by Next.js Server Components.
---

Server-rendered admin pages must pass serializable icon identifiers into shared Client Components. The Client Component owns the icon registry and renders the matching icon locally. React component functions, classes, callbacks, and action objects must not cross that boundary.

**Why:** Next.js App Router cannot serialize a Lucide/React component function passed as a prop from a Server Component. The page then crashes before rendering even though the icon itself is purely visual.

**How to apply:** Use the shared action control's string icon identifier API from Server Components. Component-valued icon props are acceptable only when both caller and callee are already Client Components. When adding a new server-rendered action icon, extend the client-owned identifier registry instead of importing and passing the icon function from the server page.