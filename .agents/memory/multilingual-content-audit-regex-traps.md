---
name: Multilingual content audit regex traps
description: Recurring substring false-positive traps when regex-scanning multilingual blog content (Istanbul VIP Transfer) for topic co-occurrence (e.g. toll/fee mentions); how to avoid inflated counts.
---

When scanning `content` (TR source, content_type='BLOG_POST') + `content_translations` (entity_type='content') bodies across 8+ languages for a topic (e.g. "does this sentence mention money together with a bridge/tunnel/highway"), naive substring regexes produce large false-positive inflation. Observed traps in this codebase's blog corpus:

- Dutch `tol` (toll) as a bare substring matches inside "Ana**tol**ische"/"ana**tol**ica" (Anatolian, DE/IT) — unrelated to tolls.
- English/Romance `cost` as a bare substring matches inside Spanish/Italian "co**st**a"/"co**st**eras" (coast/coastal) — unrelated to price.
- Bare `TL` (Turkish Lira) matches inside "Şehi**tl**er" (Şehitler, a bridge's proper name) — unrelated to currency.
- Russian `цен` (price root) matches inside "**цен**тр"/"**цен**тра" (center/of the center) — unrelated to price.
- Arabic `شامل` (comprehensive/included) as a bare substring matches inside "ت**شامل**يجا" (Çamlıca, a place name transliterated from Turkish) — unrelated to inclusion/price.
- German compounds merge nouns with no boundary (e.g. "Fähr**gebühr**en" = ferry fees, "Autobahn**gebühren**" = highway fees): a strict word-boundary-before requirement on the fee root misses these. Need a boundary-after-only check for German fee roots (gebühr, kosten, maut, preis, inklus, enthalten).
- Arabic plurals change the root spelling (جسر singular "bridge" → جسور plural "bridges"); a bare-literal check for the singular misses plural mentions. Check both forms plus phrase-level literals like "رسوم الطرق" (road fees).

**Why:** An initial loose regex on this corpus inflated a "genuine toll-fee mention" count from a defensible ~26 sentences to 104+ matches, purely from these substring collisions across 8 languages. Reporting the inflated number to the user would have been materially wrong.

**How to apply:** For any future cross-language "topic co-occurrence" audit on this content, (1) use Unicode-aware word-boundary lookarounds `(?<![\p{L}\p{N}_])root\p{L}*(?![\p{L}\p{N}_])` per token rather than bare substrings, (2) run German and Arabic as separate passes with the compound/plural adjustments above, (3) after getting a candidate list, print which literal token matched each sentence (not just the sentence) to spot remaining false positives before trusting a count, (4) treat any headline count as provisional until this token-level check is done.
