---
name: Fleet-page translation gate
description: Non-obvious quality rules for translating the fleet-selection article and FAQs.
---

Fleet-page translations must preserve the source's exact digit-token sequence, while durations written as words remain written as words with unchanged meaning. Generic Turkish category labels such as “Midibüs” and “Otobüs” must be translated naturally rather than treated as protected model names.

**Why:** Early AI drafts retained Turkish category labels, and one Arabic retry converted a written five-hour duration into a numeric range even though the capacity digits were otherwise correct. Generic LLM review was also inconsistent about whether translated category labels were allowed.

**How to apply:** Save candidates as drafts first. Combine deterministic number/forbidden-term/FAQ checks with native-language review, explicitly treating only real brand and model names as protected. Publish only after both layers pass.