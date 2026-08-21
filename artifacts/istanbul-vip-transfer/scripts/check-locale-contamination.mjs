#!/usr/bin/env node
/**
 * Cross-locale contamination test.
 *
 * Detects:
 *  1. Arabic script (U+0600–U+06FF) appearing in any non-Arabic locale
 *     (tr, en, de, ru, es, fr, it, nl).
 *  2. Turkish-specific UI phrases remaining in non-Turkish public pages.
 *
 * Run: node scripts/check-locale-contamination.mjs
 * Exit code 0 = clean. Exit code 1 = contamination found.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Arabic script Unicode range ───────────────────────────────────────────
const ARABIC_RE = /[\u0600-\u06FF]/;

// ── Turkish UI phrases that must not appear in non-Turkish public output ─
// These are source-language admin-facing strings, not public visitor text.
const TURKISH_UI_PHRASES = [
  'Rezervasyon Desteği',
  'Havalimanı Transferi',
  'VIP Araç Seçenekleri',
  'Neden Biz',
  'Hizmet Anlayışımız',
  'Hizmetlerimiz',
  'Her İhtiyaca Uygun',
  'Lüks Mercedes Filomuz',
  'Tüm Hizmetler',
];

// ── Locales and their dictionary paths ───────────────────────────────────
const NON_ARABIC_LOCALES = ['tr', 'en', 'de', 'ru', 'es', 'fr', 'it', 'nl'];
const NON_TURKISH_LOCALES = ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl'];
const DICT_DIR = join(ROOT, 'lib/i18n/dictionaries');

// ── Homepage fallback file ────────────────────────────────────────────────
const HOMEPAGE_TYPES_PATH = join(ROOT, 'lib/homepage-types.ts');

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`  ✗ FAIL: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠ WARN: ${msg}`);
  warnings++;
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

// ── 1. Check dictionary files for Arabic in non-Arabic locales ────────────
console.log('\n── 1. Dictionary files: Arabic script in non-Arabic locales ──');
for (const locale of NON_ARABIC_LOCALES) {
  const dictPath = join(DICT_DIR, `${locale}.ts`);
  let src;
  try {
    src = readFileSync(dictPath, 'utf8');
  } catch {
    warn(`Dictionary not found: ${locale}.ts`);
    continue;
  }

  // Extract string literals and check for Arabic characters
  const stringLiterals = src.match(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [];
  const contaminated = stringLiterals.filter(s => ARABIC_RE.test(s));
  if (contaminated.length > 0) {
    fail(`${locale}.ts contains Arabic script in ${contaminated.length} string(s): ${contaminated.slice(0, 3).join(', ')}`);
  } else {
    pass(`${locale}.ts — no Arabic script`);
  }
}

// ── 2. Check non-Turkish dictionaries for Turkish UI phrases ──────────────
console.log('\n── 2. Dictionary files: Turkish UI phrases in non-Turkish locales ──');
for (const locale of NON_TURKISH_LOCALES) {
  const dictPath = join(DICT_DIR, `${locale}.ts`);
  let src;
  try {
    src = readFileSync(dictPath, 'utf8');
  } catch {
    continue;
  }

  const found = TURKISH_UI_PHRASES.filter(phrase => src.includes(phrase));
  if (found.length > 0) {
    fail(`${locale}.ts contains Turkish UI phrase(s): ${found.join(', ')}`);
  } else {
    pass(`${locale}.ts — no Turkish UI leak`);
  }
}

// ── 3. Check homepage-types.ts HOMEPAGE_FALLBACK ─────────────────────────
console.log('\n── 3. homepage-types.ts HOMEPAGE_FALLBACK: Arabic in non-Arabic locales ──');
const homepageSrc = readFileSync(HOMEPAGE_TYPES_PATH, 'utf8');

// Extract each locale block and check es/fr/it/nl do NOT contain Arabic.
// Strategy: find 'es:' and take everything from there to the end of the file;
// the ar section comes BEFORE es in the object so this avoids the ar content.
const esStart = homepageSrc.indexOf("\n  es:");
if (esStart === -1) {
  warn('homepage-types.ts: es/fr/it/nl sections not found — add HOMEPAGE_FALLBACK entries');
} else {
  const ltrSection = homepageSrc.slice(esStart);
  if (ARABIC_RE.test(ltrSection)) {
    // Find which line
    const lines = ltrSection.split('\n');
    const badLines = lines.filter(l => ARABIC_RE.test(l));
    fail(`homepage-types.ts: Arabic script found in es/fr/it/nl HOMEPAGE_FALLBACK section: ${badLines[0]?.trim().slice(0, 80)}`);
  } else {
    pass('homepage-types.ts — es/fr/it/nl HOMEPAGE_FALLBACK sections contain no Arabic script');
  }
}

// ── 4. Check Services.tsx for positional language fallback bug ─────────────
console.log('\n── 4. Services.tsx: positional Arabic fallback bug ──');
const servicesTsxPath = join(ROOT, 'components/Services.tsx');
const servicesSrc = readFileSync(servicesTsxPath, 'utf8');

// The old bug: (tr, en, de, ru, ar) => ... : ar  (final else returning Arabic)
if (/\(tr:\s*string.*ar:\s*string\)\s*=>/.test(servicesSrc)) {
  fail('Services.tsx still has the old positional serviceDesc(tr,en,de,ru,ar) function signature');
} else if (/map\[lang\]\s*\?\?\s*map\.en/.test(servicesSrc) || /map\[lang\].*\?\?.*map/.test(servicesSrc)) {
  pass('Services.tsx uses locale-keyed map — no positional fallback');
} else {
  warn('Services.tsx: unable to verify locale selection pattern — manual review recommended');
}

// ── 5. Check blog/page.tsx Arabic fallback ────────────────────────────────
console.log('\n── 5. blog/page.tsx: Arabic fallback for es/fr/it/nl ──');
const blogPagePath = join(ROOT, 'app/[lang]/blog/page.tsx');
const blogSrc = readFileSync(blogPagePath, 'utf8');

// Old bug: lang === 'ru' ? '...' : 'مقالات وأدلة'  (Arabic as final else)
// Fixed version uses a Record map
if (/lang\s*===\s*'ru'\s*\?[^:]+:\s*['"][\u0600-\u06FF]/.test(blogSrc)) {
  fail('blog/page.tsx still uses Arabic as fallback for non-Arabic locales');
} else {
  pass('blog/page.tsx — Arabic not used as final else fallback');
}

// ── 6. Scan component files for hardcoded Arabic strings in non-AR context ─
console.log('\n── 6. Component scan: unexpected Arabic strings in LTR components ──');
const COMPONENTS_DIR = join(ROOT, 'components');
const SKIP_PATTERNS = [/ChatWidget/, /rtl/, /ar\./i]; // ChatWidget may have Arabic for ar locale

/**
 * Returns true when an Arabic-containing line is legitimately guarded:
 *  - it is inside a locale-keyed map accessed via [lang] (pattern: `ar: '...'` object key)
 *  - it is inside a block guarded by `lang === 'ar'`
 *  - it is inside a locale array keyed by 'ar'
 * We look at a wider context (10 lines up) to detect these patterns.
 */
function isArGuarded(lines, lineIdx) {
  // Look back up to 25 lines to catch Arabic content nested deep inside an ar: block
  const context = lines.slice(Math.max(0, lineIdx - 25), lineIdx + 5).join('\n');
  // Locale-map object key pattern: `  ar: {` or `ar: [`  (object accessed by [lang])
  if (/^\s+ar\s*:\s*[\[{]/m.test(context)) return true;
  // Explicit lang guard
  if (/lang\s*===\s*['"]ar['"]/.test(context)) return true;
  // The line itself is an ar: key-value
  if (/^\s+ar\s*:/.test(lines[lineIdx] ?? '')) return true;
  // Inline locale-label maps may live on one line, e.g.
  // { en: 'English', ar: 'العربية' }. They are intentionally locale-keyed.
  if (/\bar\s*:\s*['"][\u0600-\u06FF]/.test(lines[lineIdx] ?? '')) return true;
  return false;
}

function scanDir(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { scanDir(full); continue; }
    if (!['.tsx', '.ts'].includes(extname(full))) continue;
    if (SKIP_PATTERNS.some(p => p.test(full))) continue;

    const src = readFileSync(full, 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!ARABIC_RE.test(lines[i])) continue;
      if (isArGuarded(lines, i)) continue;
      warn(`${full.replace(ROOT, '')}:${i + 1} — Arabic script without ar-guard: ${lines[i].trim().slice(0, 80)}`);
    }
  }
}
scanDir(COMPONENTS_DIR);

// Also scan app/[lang]/ routes
const APP_LANG_DIR = join(ROOT, 'app/[lang]');
function scanRouteDir(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { scanRouteDir(full); continue; }
    if (!['.tsx', '.ts'].includes(extname(full))) continue;

    const src = readFileSync(full, 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!ARABIC_RE.test(lines[i])) continue;
      if (isArGuarded(lines, i)) continue;
      warn(`${full.replace(ROOT, '')}:${i + 1} — Arabic script without ar-guard: ${lines[i].trim().slice(0, 80)}`);
    }
  }
}
scanRouteDir(APP_LANG_DIR);
if (errors === 0 && warnings === 0) {
  console.log('\n  (no issues found in component/route scan)');
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
if (errors > 0) {
  console.error(`\n✗ CONTAMINATION DETECTED: ${errors} error(s), ${warnings} warning(s)\n`);
  process.exit(1);
} else if (warnings > 0) {
  console.warn(`\n⚠ Passed with ${warnings} warning(s) — manual review recommended\n`);
  process.exit(0);
} else {
  console.log('\n✓ All locale contamination checks passed — no Arabic or Turkish leaks detected\n');
  process.exit(0);
}
