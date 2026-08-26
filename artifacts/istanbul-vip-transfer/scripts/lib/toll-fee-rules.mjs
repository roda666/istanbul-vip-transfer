/**
 * Shared, side-effect-free rule set + matching logic for the toll/fee
 * customer-copy guard. Split out from scripts/check-toll-fee-mentions.mjs
 * (which additionally runs live DB queries at import time) so the rules can
 * be unit-tested directly by scripts/test-check-toll-fee-mentions.mjs without
 * touching the database.
 *
 * Regex design deliberately follows documented multilingual substring traps
 * (see .agents/memory/multilingual-content-audit-regex-traps.md and
 * .agents/memory/toll-fee-build-guard.md): every term is scoped to its OWN
 * target_language_code (never applied cross-language), uses Unicode-aware
 * boundaries, and known false-positive collisions are explicitly excluded
 * via negative lookaheads/lookbehinds rather than bare substring matching.
 */

/** Escapes a literal string for use inside a RegExp. */
export function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a Unicode-aware "whole token" matcher: no letter/digit immediately
 * before, allows trailing inflection letters (plurals/cases), and — unless
 * `compound: true` — no letter/digit immediately after either. German nouns
 * compound without a boundary in between (e.g. "Autobahngebühren"), so
 * German terms are built with compound: true (suffix-permissive both ways
 * is unnecessary; we only need to detect the root is present at all).
 *
 * IMPORTANT: only use this generic wildcard-suffix helper for roots that
 * cannot plausibly be the prefix of an unrelated real word (verified by hand
 * against a wordlist knowledge check). Short/common roots (fee, cost, fare,
 * tol, плат, сбор, costo, ponte, cargo, رسوم, ...) have needed a tighter,
 * explicit-form regex instead — see the per-language comments below for each
 * documented collision and its fix.
 */
export function tokenRe(term, { compound = false } = {}) {
  const before = compound ? '' : '(?<![\\p{L}\\p{N}_])';
  const after = '\\p{L}*(?![\\p{L}\\p{N}_])';
  return compound ? new RegExp(esc(term), 'iu') : new RegExp(before + esc(term) + after, 'iu');
}

/**
 * Per-language rule set:
 *  - direct: standalone "toll" words — geography + fee already fused into one
 *    word, so a single hit is a violation on its own.
 *  - geo: bridge/tunnel/highway/ferry geography terms.
 *  - fee: generic money/fee terms. A violation requires a `geo` AND `fee`
 *    hit in the SAME sentence.
 *  - exclude: regexes that, if they ALSO match the sentence, veto the flag
 *    (documented false-positive guards, e.g. German "kostenlos" = free).
 */
export const RULES = {
  tr: {
    direct: [/geçiş\s*ücret\p{L}*/iu],
    geo: ['köprü', 'tünel', 'otoyol', 'feribot'].map(t => tokenRe(t)),
    // "gider" (expense) must not match inside "giderken" (while going) — a
    // verb conjugation, not the expense noun. See memory: regex substring traps.
    fee: ['ücret', 'masraf', 'bedel', 'maliyet'].map(t => tokenRe(t)).concat([/(?<![\p{L}\p{N}_])gider(?!ken)\p{L}*(?![\p{L}\p{N}_])/iu]),
  },
  en: {
    direct: [tokenRe('toll')],
    geo: ['bridge', 'tunnel', 'highway', 'motorway', 'ferry'].map(t => tokenRe(t)),
    // Short fee roots must use exact-form regexes, not the generic wildcard
    // tokenRe — the open \p{L}* suffix also matches unrelated real words:
    // "fee"+"l"="feel", "cost"+"ume"="costume", "fare"+"well"="farewell",
    // "charge"+"r"="charger" (USB/phone charger, unrelated to a toll fee).
    fee: [/\bfees?\b/iu, /\bcharg(?:e|es|ed)\b/iu, /\bcost(?:s|ly|ing)?\b/iu, /\bfares?\b/iu],
  },
  de: {
    // Maut already means "toll" on its own.
    direct: [tokenRe('maut', { compound: true })],
    geo: ['brücke', 'tunnel', 'autobahn', 'fähre'].map(t => tokenRe(t, { compound: true })),
    fee: [tokenRe('gebühr', { compound: true }), /kosten(?!los)/iu],
    exclude: [],
  },
  ru: {
    direct: [/плата\s+за\s+проезд/iu, /дорожн\p{L}*\s+сбор\p{L}*/iu, /сбор\p{L}*\s+за\s+проезд/iu],
    geo: ['мост', 'туннел', 'тоннел', 'автомагистрал', 'паром'].map(t => tokenRe(t)),
    // "плат" as a fee root also matches "оплата"/"плательщик" etc. — money-related,
    // kept — but must exclude unrelated common words with the same start:
    // платье (dress), платок (kerchief), платформа (railway/station platform,
    // very likely in transfer copy), плато (plateau, e.g. a scenic tour stop).
    // "сбор" (collection/fee) must exclude сборка (assembly), сборник (anthology),
    // сборная (national sports team) — none are money-related.
    fee: [
      tokenRe('тариф'),
      /(?<![\p{L}\p{N}_])сбор(?!к|ник|ная|ной|очн)\p{L}*(?![\p{L}\p{N}_])/iu,
      /(?<![\p{L}\p{N}_])плат(?!ье|ок|форм|о(?![\p{L}\p{N}_])|яно)\p{L}*(?![\p{L}\p{N}_])/iu,
    ],
  },
  fr: {
    direct: [tokenRe('péage')],
    geo: ['pont', 'tunnel', 'autoroute', 'ferry'].map(t => tokenRe(t)),
    // NOTE (documented residual risk, not fixed): "frais" is a genuine French
    // homonym — it means both "fresh" (produits frais / air frais) and
    // "cost/fees" (frais de transport). This is a whole-word ambiguity, not a
    // substring-fragment bug, so the tokenRe fix pattern used elsewhere does
    // not apply; disambiguating it needs real phrase-context rules. Flag for
    // future work if a false positive is ever observed in practice.
    fee: ['frais', 'coût', 'tarif'].map(t => tokenRe(t)),
  },
  es: {
    direct: [tokenRe('peaje')],
    geo: ['puente', 'túnel', 'autopista', 'ferry'].map(t => tokenRe(t)),
    // "coste" (cost) must not match inside "costera/costero/costeras" (coastal)
    // — an unrelated adjective. See memory: cost-in-costa regex trap.
    // "cargo" (charge/fee) must not match "cargador" (charger/loader — very
    // likely in "cargador USB" vehicle-amenity copy) — unrelated device noun.
    // NOTE (documented residual risk, not fixed): "cargo" is also a genuine
    // Spanish homonym for "job/position" ("un cargo de gobierno"). Same class
    // of whole-word ambiguity as French "frais" above.
    fee: ['tarifa', 'costo'].map(t => tokenRe(t)).concat([
      /(?<![\p{L}\p{N}_])coste(?!r)\p{L}*(?![\p{L}\p{N}_])/iu,
      /(?<![\p{L}\p{N}_])cargo(?!dor)\p{L}*(?![\p{L}\p{N}_])/iu,
    ]),
  },
  it: {
    // 'pedaggi' (plural) is not a suffix of 'pedaggio' (singular) — matching the
    // shorter stem catches both via the trailing \p{L}* allowance in tokenRe.
    direct: [tokenRe('pedaggi')],
    // "ponte" (bridge) must not match "pontefice" (pontiff) — unrelated word
    // with the same 5-letter start.
    geo: [/(?<![\p{L}\p{N}_])ponte(?!fice)\p{L}*(?![\p{L}\p{N}_])/iu, ...['tunnel', 'autostrada', 'traghetto'].map(t => tokenRe(t))],
    // "costo" (cost) must not match "costola" (rib, a body part) — unrelated
    // word with the same 5-letter start.
    fee: ['tariffa', 'spesa'].map(t => tokenRe(t)).concat([/(?<![\p{L}\p{N}_])costo(?!la)\p{L}*(?![\p{L}\p{N}_])/iu]),
  },
  nl: {
    // "tol" (toll) must not match "tolk" (interpreter) or "tolerant"/"tolereren"
    // (tolerate) — common unrelated Dutch words with the same 3-letter start.
    // "tolvrij" (toll-FREE) is excluded too since it explicitly denies a fee,
    // mirroring the German kosten(?!los) exclusion pattern above.
    direct: [/(?<![\p{L}\p{N}_])tol(?!k(?![\p{L}\p{N}_])|erant|ere|vrij)\p{L}*(?![\p{L}\p{N}_])/iu],
    geo: ['brug', 'tunnel', 'snelweg', 'veerboot'].map(t => tokenRe(t)),
    fee: ['kosten', 'tarief'].map(t => tokenRe(t)),
  },
  ar: {
    direct: [/رسوم\s+(?:العبور|الطريق|الطرق)/iu, /رسوم\s+المرور/iu],
    geo: [/جسو?ر/iu, /نفق|أنفاق/iu, /طريق\s+سريع|أوتوستراد/iu, /عبّ?ارة|معدية/iu],
    // "رسوم" (fees) must not match inside "مرسوم" (decree/regulation) — the
    // word is literally "م" + "رسوم", an unrelated legal/administrative noun.
    fee: [/(?<!م)رسوم/iu, /تكلفة/iu, /أجرة|أجور/iu],
  },
};

export const LANGS = Object.keys(RULES).filter(l => l !== 'tr');

/** Splits text into sentences (Latin + Arabic terminators) for line-scoped checks. */
export function toSentences(text) {
  if (!text) return [];
  return text
    .split(/\n/)
    .flatMap(line => line.split(/(?<=[.!?؟])\s+/u))
    .map(s => s.trim())
    .filter(Boolean);
}

/** Returns violation descriptors for a piece of text in a given language. */
export function findViolations(text, lang, fieldLabel) {
  const rules = RULES[lang];
  if (!rules || !text) return [];
  const violations = [];
  for (const sentence of toSentences(text)) {
    if (rules.exclude?.some(re => re.test(sentence))) continue;

    const directHit = rules.direct.find(re => re.test(sentence));
    if (directHit) {
      violations.push({ field: fieldLabel, sentence, matched: directHit.source, kind: 'direct-toll-word' });
      continue;
    }

    const geoHit = rules.geo.find(re => re.test(sentence));
    const feeHit = rules.fee.find(re => re.test(sentence));
    if (geoHit && feeHit) {
      violations.push({
        field: fieldLabel,
        sentence,
        matched: `${geoHit.source} + ${feeHit.source}`,
        kind: 'geo+fee-cooccurrence',
      });
    }
  }
  return violations;
}

/** Recursively collects string leaves from a JSONB value (for route JSON columns). */
export function collectStrings(value, path = '') {
  const out = [];
  if (value == null) return out;
  if (typeof value === 'string') { out.push([path || 'value', value]); return out; }
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...collectStrings(v, `${path}[${i}]`)));
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) out.push(...collectStrings(v, path ? `${path}.${k}` : k));
    return out;
  }
  return out;
}

/**
 * Some `content` / `content_translations` rows (e.g. content_type='SERVICE')
 * store the whole structured page body as a serialized JSON object rather
 * than plain markdown. Scanning that raw JSON text as one blob glues
 * unrelated fields (e.g. a different FAQ's entrance-fee answer sitting next
 * to a ferry-route question) into a single fake "sentence", producing
 * false-positive co-occurrences. Detect JSON and scan each leaf string on
 * its own so co-occurrence only fires within a single real field/sentence.
 */
export function findViolationsInField(rawValue, lang, fieldLabel) {
  if (!rawValue) return [];
  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return findViolations(rawValue, lang, fieldLabel);
  }
  if (parsed === null || typeof parsed !== 'object') return findViolations(rawValue, lang, fieldLabel);

  const out = [];
  for (const [leafPath, leafStr] of collectStrings(parsed)) {
    out.push(...findViolations(leafStr, lang, `${fieldLabel}.${leafPath}`));
  }
  return out;
}
