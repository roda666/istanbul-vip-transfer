---
name: Cross-instance health scheduler leases
description: Concurrency and notification rules for automatic service and content health jobs.
---

Automatic health jobs that can run in multiple app instances require an atomic, expiring database lease with an owner token. Release must match the owner token, and notification cooldown state advances only after confirmed delivery.

**Why:** A process-local “started” flag prevents overlap only inside one Node process. Multiple instances can race, send duplicate alerts, and incorrectly suppress later alerts if failed sends update cooldown state.

**How to apply:** Acquire the lease before reading health inputs, return a distinct overlap result when another valid lease exists, and release in `finally` only for the current owner. Use an expiry so crashed jobs recover without manual cleanup.