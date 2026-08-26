#!/usr/bin/env node
/**
 * Self-test for scripts/check-toll-fee-mentions.mjs.
 *
 * Verifies the guard actually catches a real violation (not just that it
 * passes on already-clean content): inserts a temporary PUBLISHED content
 * row containing a known bridge-toll-fee sentence, runs the checker against
 * it, asserts it fails (exit 1) and names the planted slug, then removes the
 * temporary row and asserts the checker passes cleanly again.
 *
 * Run: node scripts/test-check-toll-fee-mentions.mjs
 */
import postgres from '../node_modules/postgres/src/index.js';
import { execFileSync } from 'node:child_process';

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

let failures = 0;

try {
  await cleanup(); // in case a prior run crashed mid-test

  // ── 1. Plant a genuine violation (geo + fee co-occurrence) ──
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

  // ── 2. Remove the violation and confirm a clean pass ──
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
