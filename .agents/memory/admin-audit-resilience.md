---
name: Admin audit resilience
description: Safety rule for audit persistence and operational failure reporting in the admin authorization layer.
---

Admin authorization must keep its allow/deny result even if either audit persistence or its reporting sink fails. Audit records and failure events must use normalized, allowlisted route categories rather than request-controlled paths, query strings, or dynamic URL segments.

**Why:** Audit infrastructure is valuable for investigation but must never become an availability dependency or a way to persist/log sensitive request-derived values.

**How to apply:** For every future audit change, use the shared writer, preserve its non-throwing typed failure behavior, and extend the allowlist only for an intentional admin area. Keep the policy test coverage for writer success, storage failure, logging failure, and adversarial paths.

Signed-upload failures follow the same bounded-reporting rule: missing storage configuration and all signer/sidecar failures return one fixed public `503` message and audit only a fixed reason. Never read or propagate a sidecar error body, signer exception, upload URL, or object-storage configuration.

**Why:** Storage signers may include bucket names, signed URLs, credentials, or operational internals in failure output; treating these failures identically prevents them from becoming a disclosure channel.

**How to apply:** Implement signed-upload endpoints through a testable handler with injected signer/config/audit dependencies, so missing config and hostile signer errors can be tested deterministically without a live storage service.