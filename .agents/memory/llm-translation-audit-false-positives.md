---
name: LLM Turkish-leftover audit false-positive rate
description: The GPT-based audit for untranslated Turkish prose in blog translations flags many items its own prompt explicitly allows, and occasionally hallucinates text that isn't in the row at all — always verify against the DB before treating a flag as real.
---

## What happened
Running `scripts/audit-blog-translation-language.mjs` (144 published blog translations, TR excluded) produced 21 "hasUntranslatedTurkish" flags. Manually checking each flagged `exactText` against the actual DB row showed:
- Most flags were proper nouns / place names / bridge names (İstanbul Havalimanı, Sabiha Gökçen, Taksim, Sultanahmet, Kapalıçarşı, Çamlıca, Fatih Sultan Mehmet Köprüsü, "İstanbul – Sapanca" route labels) — the system prompt explicitly allows these, but the model flagged them anyway, sometimes contradicting itself in its own `reason` field.
- Two flags (fr `vip-transfer-ile-taksi-arasindaki-farklar`, en `soforlu-arac-kiralama-rehberi`'s "şoförlü araç kiralama") did not exist verbatim anywhere in the row at all — outright hallucination.
- Only 7 of 21 were genuine defects: real Turkish common words/abbreviations left in table cells (Arabic "dk"/"saat"/"kara yolu"), Turkish text left inside markdown link labels in German/Dutch prose, one corrupted mixed-script word ("landingsوقت"), and one garbled non-Turkish machine-translation artifact in Italian.

**Why:** the model's allow-list instructions in the prompt are not reliably followed at scale; treating raw `flagged` count as ground truth overstates real defects by ~3x here.

**How to apply:** after running this audit (or any similar LLM content-QA script), do a direct DB `indexOf`/regex check of every flagged `exactText` against the actual row body before deciding it's a real defect or before reporting a "flagged" count to the user. If the exact text isn't found verbatim, it's a hallucination — discard it. If it's a proper noun/place/brand name, discard it per the prompt's own allow-list.
