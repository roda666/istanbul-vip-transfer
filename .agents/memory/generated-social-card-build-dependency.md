---
name: Generated social-card build dependency
description: Ensuring the build-time OG card is reliably generated in deployment environments.
---

The social-card generator relies on ImageMagick, which must be declared as a project Nix package. If its required generator is unavailable or the produced file is invalid, the prebuild must emit a clear diagnostic and fail rather than continue with a missing or stale public asset.

**Why:** Deployment environments can differ from the interactive workspace; an ambient executable is not a reliable production dependency, and the generated card is intentionally excluded from source control.

**How to apply:** Keep the package declaration, prebuild hook, and generated-file validation aligned whenever changing the social-card pipeline or any other build-generated public asset.