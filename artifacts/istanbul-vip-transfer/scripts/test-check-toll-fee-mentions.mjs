#!/usr/bin/env node
/**
 * Self-test for scripts/check-toll-fee-mentions.mjs.
 *
 * Two layers:
 *   1. Unit tests against the shared rule set (scripts/lib/toll-fee-rules.mjs)
 *      directly — no DB needed. Covers known substring-collision false
 *      positives ("fee" must not fire on "feel"/"feeling", etc.) AND confirms
 *      the corresponding genuine violation is still caught ("toll fee" must
 *      still fire).
 *   2. End-to-end DB test: inserts a temporary PUBLISHED content row
 *      containing a known bridge-toll-fee sentence, runs the checker against
 *      it, asserts it fails (exit 1) and names the planted slug, then removes
 *      the temporary row and asserts the checker passes cleanly again.
 *
 * Run: node scripts/test-check-toll-fee-mentions.mjs
 */
import postgres from '../node_modules/postgres/src/index.js';
import { execFileSync } from 'node:child_process';
import { findViolations } from './lib/toll-fee-rules.mjs';

let failures = 0;

// ── 1. Unit tests: substring-collision false positives + genuine catches ──
//
// Each case: { lang, text, expectViolation, note }. `text` is a single
// sentence run through findViolations() directly against the real rule set.
const CASES = [
  // English "fee" vs "feel"/"feeding" — the bug reported by the user.
  { lang: 'en', text: 'The driver will feel free to help with your bags.', expectViolation: false, note: 'en: "feel" must not match "fee"' },
  { lang: 'en', text: 'We recommend feeding the parking meter before you leave.', expectViolation: false, note: 'en: "feeding" must not match "fee"' },
  { lang: 'en', text: 'A bridge toll fee applies on this route.', expectViolation: true, note: 'en: genuine "toll fee" + bridge must still fire' },
  { lang: 'en', text: 'There is no extra fee for crossing the bridge.', expectViolation: true, note: 'en: genuine "fee" + bridge must still fire' },
  // English "cost"/"fare"/"charge" collisions.
  { lang: 'en', text: 'Passengers wear a traditional costume for the ferry photo.', expectViolation: false, note: 'en: "costume" must not match "cost"' },
  { lang: 'en', text: 'The tunnel toll cost is not included in the quoted price.', expectViolation: true, note: 'en: genuine "cost" + tunnel must still fire' },
  { lang: 'en', text: 'A USB charger is available in the back seat near the ferry dock.', expectViolation: false, note: 'en: "charger" must not match "charge"' },
  { lang: 'en', text: 'The bridge crossing charge is billed separately.', expectViolation: true, note: 'en: genuine "charge" + bridge must still fire' },
  { lang: 'en', text: 'We said our farewell at the ferry terminal.', expectViolation: false, note: 'en: "farewell" must not match "fare"' },
  { lang: 'en', text: 'The ferry fare is not included in the transfer price.', expectViolation: true, note: 'en: genuine "fare" + ferry must still fire' },
  // Dutch "tol" vs "tolk"/"tolereren".
  { lang: 'nl', text: 'Een tolk is op aanvraag beschikbaar tijdens de rit.', expectViolation: false, note: 'nl: "tolk" (interpreter) must not match "tol"' },
  { lang: 'nl', text: 'Wij tolereren geen roken in de auto tijdens de veerboot overtocht.', expectViolation: false, note: 'nl: "tolereren" must not match "tol"' },
  { lang: 'nl', text: 'Deze snelweg is volledig tolvrij voor alle voertuigen.', expectViolation: false, note: 'nl: "tolvrij" (toll-FREE) must not be flagged as a fee' },
  { lang: 'nl', text: 'Voor deze brug moet u tol betalen.', expectViolation: true, note: 'nl: genuine standalone "tol" must still fire' },
  // Russian "плат" vs "платье"/"платформа"/"плато"; "сбор" vs "сборка"/"сборная".
  { lang: 'ru', text: 'На пароме есть небольшая платформа для багажа.', expectViolation: false, note: 'ru: "платформа" (platform) must not match "плат"' },
  { lang: 'ru', text: 'Гид посоветовал взять тёплое платье перед поездкой к мосту.', expectViolation: false, note: 'ru: "платье" (dress) must not match "плат"' },
  { lang: 'ru', text: 'После тоннеля откроется живописное плато.', expectViolation: false, note: 'ru: "плато" (plateau) must not match "плат"' },
  { lang: 'ru', text: 'Сборка мебели на пароме не производится.', expectViolation: false, note: 'ru: "сборка" (assembly) must not match "сбор"' },
  { lang: 'ru', text: 'Оплата за проезд по мосту взимается отдельно.', expectViolation: true, note: 'ru: genuine "оплата" + мост must still fire' },
  { lang: 'ru', text: 'Дорожный сбор за туннель включён в стоимость.', expectViolation: true, note: 'ru: genuine "дорожный сбор" direct rule must still fire' },
  // Italian "costo" vs "costola"; "ponte" vs "pontefice".
  { lang: 'it', text: 'Il passeggero si è fatto male alla costola durante il traghetto.', expectViolation: false, note: 'it: "costola" (rib) must not match "costo"' },
  { lang: 'it', text: 'Il Pontefice ha visitato la città in traghetto.', expectViolation: false, note: 'it: "Pontefice" must not match "ponte"' },
  { lang: 'it', text: 'Il costo del pedaggio per il ponte non è incluso.', expectViolation: true, note: 'it: genuine "costo" + ponte must still fire' },
  // Spanish "cargo" vs "cargador".
  { lang: 'es', text: 'Hay un cargador USB disponible junto al puente.', expectViolation: false, note: 'es: "cargador" (charger) must not match "cargo"' },
  { lang: 'es', text: 'El cargo del peaje del puente se cobra aparte.', expectViolation: true, note: 'es: genuine "cargo" + puente must still fire' },
  // Arabic "رسوم" vs "مرسوم".
  { lang: 'ar', text: 'صدر مرسوم جديد بخصوص تنظيم المرور بالقرب من الجسر.', expectViolation: false, note: 'ar: "مرسوم" (decree) must not match "رسوم"' },
  { lang: 'ar', text: 'رسوم عبور الجسر غير مشمولة في السعر.', expectViolation: true, note: 'ar: genuine "رسوم" + جسر must still fire' },
];

for (const { lang, text, expectViolation, note } of CASES) {
  const hits = findViolations(text, lang, 'test');
  const got = hits.length > 0;
  if (got !== expectViolation) {
    console.error(`✗ FAIL: ${note}`);
    console.error(`  text: "${text}"`);
    console.error(`  expected violation=${expectViolation}, got=${got}${got ? ` (matched: ${hits.map(h => h.matched).join(', ')})` : ''}`);
    failures++;
  } else {
    console.log(`✓ ${note}`);
  }
}

// ── 2. End-to-end DB test ──────────────────────────────────────────────────
const sql = postgres(process.env.DATABASE_URL);
const TEST_SLUG = '_tmp_toll_fee_guard_self_test';

function runChecker() {
  try {
    const output = execFileSync('node', ['scripts/check-toll-fee-mentions.mjs'], { encoding: 'utf8' });
    return { exitCode: 0, output };
  } catch (err) {
    return { exitCode: err.status ?? 1, output: (err.stdout ?? '') + (err.stderr ?? '') };
  }
}

async function cleanup() {
  await sql`DELETE FROM content WHERE slug = ${TEST_SLUG}`;
}

try {
  await cleanup(); // in case a prior run crashed mid-test

  // ── 2a. Plant a genuine violation (geo + fee co-occurrence) ──
  await sql`
    INSERT INTO content (slug, content_type, status, title, body, created_at, updated_at)
    VALUES (
      ${TEST_SLUG}, 'BLOG_POST', 'PUBLISHED', 'Toll fee guard self-test',
      ${'Bu bir test cümlesidir. Köprü geçiş ücretinin fiyata dahil olup olmadığını sürücüye sorun.'},
      now(), now()
    )`;

  const dirty = runChecker();
  if (dirty.exitCode !== 1) {
    console.error(`✗ FAIL: expected exit code 1 with a planted violation, got ${dirty.exitCode}`);
    failures++;
  } else if (!dirty.output.includes(TEST_SLUG)) {
    console.error(`✗ FAIL: checker failed (good) but did not report the planted slug ${TEST_SLUG}`);
    console.error(dirty.output);
    failures++;
  } else {
    console.log(`✓ Checker correctly failed on planted violation and named slug=${TEST_SLUG}`);
  }

  // ── 2b. Remove the violation and confirm a clean pass ──
  await cleanup();
  const clean = runChecker();
  if (clean.exitCode !== 0) {
    console.error(`✗ FAIL: expected exit code 0 after removing the planted violation, got ${clean.exitCode}`);
    console.error(clean.output);
    failures++;
  } else {
    console.log('✓ Checker passes cleanly once the planted violation is removed.');
  }
} finally {
  await cleanup();
  await sql.end();
}

if (failures > 0) {
  console.error(`\n✗ ${failures} self-test assertion(s) failed.`);
  process.exit(1);
}
console.log('\n✓ All toll-fee guard self-test assertions passed.');
process.exit(0);
