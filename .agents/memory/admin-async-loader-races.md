---
name: Admin async loader races
description: Prevent overlapping settings loads from resetting newer user input.
---

Admin settings loaders must apply only the newest in-flight request result when they populate controlled form state.

**Why:** Development Strict Mode and ordinary overlapping refreshes can let an older response arrive after inputs become editable, silently replacing text the admin has already entered.

**How to apply:** For async loaders that seed controlled forms, track a monotonically increasing request generation (or cancel superseded requests) and ignore stale success, error, and loading-state updates.