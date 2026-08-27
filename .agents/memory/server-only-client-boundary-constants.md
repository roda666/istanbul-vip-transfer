---
name: server-only/client-component boundary for shared constants
description: When a pure-constants module (enums/labels) is imported by a client component, keep it out of any file marked 'server-only' or importing db/drizzle — otherwise the build fails immediately once that server-only file is bundled client-side.
---

Pattern observed: a "shared constants" file (e.g. vehicle/tariff class enums + labels) lived inside a
module that also had `'server-only'` (directly or transitively via db imports). A client component
(`'use client'`) importing just the constants pulled in the whole server-only module, breaking the
Next.js build with a server-only import error. Separately, another client component had **duplicated**
the same constants inline specifically to avoid this problem — creating drift risk between the two copies.

**Why:** Next.js enforces the server/client boundary at the module graph level, not the symbol level —
importing one named export from a file still bundles every import that file has, including `server-only`
and db/drizzle. A constants-only file that's safe today becomes a build break the moment someone adds a
db import to the same file.

**How to apply:** Give pure constants/enums/labels used by both server and client code their own
dependency-free module (no `server-only`, no db/drizzle imports). Have server-only modules re-export from
it if needed for compatibility. Never duplicate the same constants across files to dodge this — extract
instead. When a Next.js build fails with a server-only import error, check whether the failing import is
just for constants that could be hoisted out of the server-only file.
