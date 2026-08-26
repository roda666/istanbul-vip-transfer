#!/usr/bin/env node
/**
 * Build-time guard: fails when customer-visible copy (blog posts, service
 * pages, homepage, vehicle copy, and transfer route pages) mentions the PRICE
 * of a bridge/tunnel/highway/ferry crossing. Pricing for these crossings is
 * handled exclusively by the protected toll pricing engine (toll_points /
 * toll_tariffs) — public prose must never quote or imply a crossing fee.
 *
 * Purely geographic mentions ("the route crosses a bridge/highway") are
 * intentionally allowed and must NOT be flagged — only sentences where a
 * geography term (bridge/tunnel/highway/ferry) co-occurs with a money term
 * (fee/toll/cost/charge), or a dedicated "toll" word appears on its own
 * (toll/péage/peaje/pedaggio/Maut/tol/geçiş ücreti/رسوم العبور — these already
 * mean "crossing fee" without needing a separate geography word).
 *
 * Scans two customer-visible sources, scoped to PUBLISHED rows only:
 *   1. content (TR source) + content_translations (8 target languages) —
 *      covers blog posts, service pages, homepage, and vehicle copy.
 *   2. transfer_routes (TR source) + transfer_route_translations —
 *      covers route pages, including JSONB transport_options/route_notes/faq_items.
 *
 * Regex design deliberately follows documented multilingual substring traps
 * (see .agents/memory/multilingual-content-audit-regex-traps.md): every term
 * is scoped to its OWN target_language_code (never applied cross-language),
 * uses Unicode-aware boundaries, and known false-positive collisions
 * (tol-in-Anatolisch, cost-in-costa, цен-in-центр, TL-in-Şehitler,
 * German noun compounding, Arabic plurals) are explicitly handled.
 *
 * Run: node scripts/check-toll-fee-mentions.mjs
 * Exit code 0 = clean. Exit code 1 = a genuine fee mention was found.
 */
import postgres from '../node_modules/postgres/src/index.js';

const sql = postgres(process.env.DATABASE_URL);

/** Escapes a literal string for use inside a RegExp. */
function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a Unicode-aware "whole token" matcher: no letter/digit immediately
 * before, allows trailing inflection letters (plurals/cases), and — unless
 * `compound: true` — no letter/digit immediately after either. German nouns
 * compound without a boundary in between (e.g. "Autobahngebühren"), so
 * German terms are built with compound: true (suffix-permissive both ways
 * is unnecessary; we only need to detect the root is present at all).
 */
function tokenRe(term, { compound = false } = {}) {
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
const RULES = {
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
    // "fee" must be exact-plural only (not the generic wildcard tokenRe) —
    // the open \p{L}* suffix also matches unrelated real words like "feel"/"feed".
    fee: [/\bfees?\b/iu, tokenRe('charge'), tokenRe('cost'), tokenRe('fare')],
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
    fee: ['тариф', 'сбор', 'плат'].map(t => tokenRe(t)),
    // "плат" as a fee root also matches "оплата"/"плательщик" etc. — all money-related, kept.
  },
  fr: {
    direct: [tokenRe('péage')],
    geo: ['pont', 'tunnel', 'autoroute', 'ferry'].map(t => tokenRe(t)),
    fee: ['frais', 'coût', 'tarif'].map(t => tokenRe(t)),
  },
  es: {
    direct: [tokenRe('peaje')],
    geo: ['puente', 'túnel', 'autopista', 'ferry'].map(t => tokenRe(t)),
    // "coste" (cost) must not match inside "costera/costero/costeras" (coastal)
    // — an unrelated adjective. See memory: cost-in-costa regex trap.
    fee: ['tarifa', 'costo', 'cargo'].map(t => tokenRe(t)).concat([/(?<![\p{L}\p{N}_])coste(?!r)\p{L}*(?![\p{L}\p{N}_])/iu]),
  },
  it: {
    // 'pedaggi' (plural) is not a suffix of 'pedaggio' (singular) — matching the
    // shorter stem catches both via the trailing \p{L}* allowance in tokenRe.
    direct: [tokenRe('pedaggi')],
    geo: ['ponte', 'tunnel', 'autostrada', 'traghetto'].map(t => tokenRe(t)),
    fee: ['tariffa', 'costo', 'spesa'].map(t => tokenRe(t)),
  },
  nl: {
    direct: [tokenRe('tol')],
    geo: ['brug', 'tunnel', 'snelweg', 'veerboot'].map(t => tokenRe(t)),
    fee: ['kosten', 'tarief'].map(t => tokenRe(t)),
  },
  ar: {
    direct: [/رسوم\s+(?:العبور|الطريق|الطرق)/iu, /رسوم\s+المرور/iu],
    geo: [/جسو?ر/iu, /نفق|أنفاق/iu, /طريق\s+سريع|أوتوستراد/iu, /عبّ?ارة|معدية/iu],
    fee: [/رسوم/iu, /تكلفة/iu, /أجرة|أجور/iu],
  },
};

const LANGS = Object.keys(RULES).filter(l => l !== 'tr');

/** Splits text into sentences (Latin + Arabic terminators) for line-scoped checks. */
function toSentences(text) {
  if (!text) return [];
  return text
    .split(/\n/)
    .flatMap(line => line.split(/(?<=[.!?؟])\s+/u))
    .map(s => s.trim())
    .filter(Boolean);
}

/** Returns violation descriptors for a piece of text in a given language. */
function findViolations(text, lang, fieldLabel) {
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
function collectStrings(value, path = '') {
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
function findViolationsInField(rawValue, lang, fieldLabel) {
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

const findings = [];
let scannedRows = 0;

// ── 1. content (TR) ──────────────────────────────────────────────────────
{
  const rows = await sql`
    SELECT id, slug, content_type, title, excerpt, body, seo_title, seo_description
    FROM content WHERE status = 'PUBLISHED'`;
  for (const row of rows) {
    scannedRows++;
    for (const [field, val] of [
      ['title', row.title], ['excerpt', row.excerpt], ['body', row.body],
      ['seo_title', row.seo_title], ['seo_description', row.seo_description],
    ]) {
      for (const v of findViolationsInField(val, 'tr', field)) {
        findings.push({ source: 'content', slug: row.slug, contentType: row.content_type, lang: 'tr', ...v });
      }
    }
  }
}

// ── 2. content_translations (non-TR) ────────────────────────────────────
{
  const rows = await sql`
    SELECT ct.id, ct.entity_type, ct.target_language_code AS lang, ct.title, ct.excerpt, ct.body,
           ct.meta_title, ct.meta_description, c.slug AS source_slug, c.content_type
    FROM content_translations ct
    LEFT JOIN content c ON c.id::text = ct.entity_id
    WHERE ct.status = 'PUBLISHED' AND ct.target_language_code = ANY(${LANGS})`;
  for (const row of rows) {
    scannedRows++;
    for (const [field, val] of [
      ['title', row.title], ['excerpt', row.excerpt], ['body', row.body],
      ['meta_title', row.meta_title], ['meta_description', row.meta_description],
    ]) {
      for (const v of findViolationsInField(val, row.lang, field)) {
        findings.push({
          source: 'content_translations', slug: row.source_slug ?? `entity:${row.entity_type}`,
          contentType: row.content_type ?? row.entity_type, lang: row.lang, ...v,
        });
      }
    }
  }
}

// ── 3. transfer_routes (TR) ──────────────────────────────────────────────
{
  const rows = await sql`
    SELECT id, slug, description, seo_title, seo_description, intro_paragraph,
           transport_options, route_notes, faq_items
    FROM transfer_routes WHERE active = true`;
  for (const row of rows) {
    scannedRows++;
    for (const [field, val] of [
      ['description', row.description], ['seo_title', row.seo_title],
      ['seo_description', row.seo_description], ['intro_paragraph', row.intro_paragraph],
    ]) {
      for (const v of findViolations(val, 'tr', field)) {
        findings.push({ source: 'transfer_routes', slug: row.slug, contentType: 'ROUTE', lang: 'tr', ...v });
      }
    }
    for (const jsonField of ['transport_options', 'route_notes', 'faq_items']) {
      for (const [path, str] of collectStrings(row[jsonField])) {
        for (const v of findViolations(str, 'tr', `${jsonField}.${path}`)) {
          findings.push({ source: 'transfer_routes', slug: row.slug, contentType: 'ROUTE', lang: 'tr', ...v });
        }
      }
    }
  }
}

// ── 4. transfer_route_translations (non-TR) ─────────────────────────────
{
  const rows = await sql`
    SELECT trt.id, trt.language_code AS lang, trt.description, trt.seo_title, trt.seo_description,
           trt.intro_paragraph, trt.transport_options, trt.route_notes, trt.faq_items, tr.slug
    FROM transfer_route_translations trt
    JOIN transfer_routes tr ON tr.id = trt.route_id
    WHERE trt.status = 'PUBLISHED' AND trt.language_code = ANY(${LANGS})`;
  for (const row of rows) {
    scannedRows++;
    for (const [field, val] of [
      ['description', row.description], ['seo_title', row.seo_title],
      ['seo_description', row.seo_description], ['intro_paragraph', row.intro_paragraph],
    ]) {
      for (const v of findViolations(val, row.lang, field)) {
        findings.push({ source: 'transfer_route_translations', slug: row.slug, contentType: 'ROUTE', lang: row.lang, ...v });
      }
    }
    for (const jsonField of ['transport_options', 'route_notes', 'faq_items']) {
      for (const [path, str] of collectStrings(row[jsonField])) {
        for (const v of findViolations(str, row.lang, `${jsonField}.${path}`)) {
          findings.push({ source: 'transfer_route_translations', slug: row.slug, contentType: 'ROUTE', lang: row.lang, ...v });
        }
      }
    }
  }
}

await sql.end();

console.log(`\n── Toll/fee customer-copy check — scanned ${scannedRows} published rows across content + transfer_routes ──\n`);

if (findings.length === 0) {
  console.log('✓ No bridge/tunnel/highway/ferry FEE mentions found in customer-visible copy.\n');
  process.exit(0);
}

for (const f of findings) {
  console.error(`✗ [${f.source}] slug=${f.slug} type=${f.contentType} lang=${f.lang} field=${f.field} (${f.kind})`);
  console.error(`  "${f.sentence}"`);
}
console.error(`\n✗ FAILED: ${findings.length} customer-visible sentence(s) mention a bridge/tunnel/highway/ferry crossing FEE.`);
console.error('  Toll/crossing pricing must only ever come from the protected toll pricing engine.');
console.error('  Rewrite the sentence(s) above to drop the fee mention (geography-only phrasing is fine).\n');
process.exit(1);
