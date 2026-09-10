---
name: Server-side image probe safety
description: Security boundary for checking whether admin-managed public images remain reachable.
---

Any server-side reachability check for an admin-managed image URL must allow only approved HTTPS image hosts, reject IP literals, and refuse redirects. Stable first-party storage paths may bypass the network only in flows where upload success is already authoritative; metadata availability checks must probe them through the approved public origin.

**Why:** A URL validator that fetches arbitrary hosts is an SSRF sink, and following redirects lets an initially approved host redirect the server to an internal target. Blindly trusting a previously uploaded path also leaves broken social metadata after an object is deleted.

**How to apply:** Enforce the host/protocol boundary immediately before every outbound probe, including save-time validation. Keep redirect handling disabled and use a bounded timeout/cache. If a metadata probe fails, use the service-specific fallback rather than emitting the unreachable URL.