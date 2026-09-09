---
name: Custom vehicle feature translation
description: Records the save-time translation rule for fleet-wide custom vehicle amenities.
---

Only Turkish is required for a new custom vehicle feature. On save, generate each missing public-locale value through the same AI translation provider used by service content; never overwrite a non-empty admin-edited translation.

**Why:** The owner does not want to enter nine labels manually, but must retain control to correct any generated translation later.

**How to apply:** Translate only blank EN/DE/RU/AR/FR/ES/IT/NL values, require all generated values before committing the DB update, and return a visible error without a partial save if any translation fails.