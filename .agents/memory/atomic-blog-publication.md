---
name: Atomic Blog publication
description: Durable release rule for publishing Turkish Blog content with all eight public translations.
---

Blog’s “8 Dile Çevir ve Yayınla” flow must stage translation results outside the live translation rows. Publish Turkish plus EN/DE/RU/AR/ES/FR/IT/NL in one database transaction only after all eight payloads pass the existing field, URL, internal-link, quality, and security checks and the Turkish source hash still matches.

**Why:** Publishing Turkish first or writing each translation as it finishes creates a partially public release. A provider failure, browser interruption, or source edit must leave all currently public content unchanged.

**How to apply:** Keep generic translation jobs unchanged. Use the atomic path only for explicitly marked Blog release jobs; retain staged payloads for retry, protect manually locked translations unless force retry was explicitly approved, and invalidate public Blog caches only after the final transaction commits.

The Blog editor must drain server-assigned `RETRYING` tasks through the automatic attempt limit before presenting the explicit failed-task retry action. Explicit retry must reset attempts and queue only failed tasks; completed locale tasks must not run again.

**Why:** A provider failure can otherwise leave the parent job permanently running with no usable retry control, or charge again for translations that already completed.

**How to apply:** Keep the client pass count aligned with the task runner attempt limit, then verify that a controlled single-locale failure preserves the Turkish draft and existing public translations while a later retry invokes only that locale.