---
name: Legacy CMS body evolution
description: How to add structured fields to serialized CMS bodies without breaking background workers that read older records.
---

When a structured field is added to a serialized CMS body, normalize it both in the public/admin parser and in shared-field synchronization code. Shared sync must tolerate the field being absent on an older target body and rebuild its canonical structure from the current source.

**Why:** Background translation workers can read existing bodies with direct JSON parsing instead of the normal public/admin parser. Parser-only normalization therefore leaves a runtime crash path for records created before the field existed.

**How to apply:** For every newly added array or nested object, test a legacy target with that field deleted. Confirm parsing, shared sync, translation application, and background task execution all remain safe.