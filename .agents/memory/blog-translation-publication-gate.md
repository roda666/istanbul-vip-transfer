---
name: Blog translation publication gate
description: Prevent untranslated Turkish visitor copy from publishing without false positives in other target languages.
---

Blog translations must be held as drafts until they have required metadata and no visible Turkish grammatical residue. Quality checks must operate on rendered text rather than Markdown URLs or image paths.

**Why:** Direct bulk publishing previously allowed Turkish link labels and phrases into localized public articles. A naive single-word Turkish detector also falsely matched ordinary German words such as “her”.

**How to apply:** Block publication for missing core fields or strong Turkish grammatical markers. Treat short ambiguous words as corroborating evidence only, never as a sole blocker; preserve Markdown URLs while correcting only visible labels and prose.