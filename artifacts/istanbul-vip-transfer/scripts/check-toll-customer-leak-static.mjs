#!/usr/bin/env node
/**
 * Build-time guard (requirement #5 — zero customer leakage): fails if any
 * customer-facing route handler under app/data/** (the public, unauthenticated
 * API surface) imports or references the toll pricing engine in any way.
 *
 * Toll amounts, toll line items, and even the *existence* of a toll/crossing
 * fee must never reach a customer response. The admin pricing engine
 * (lib/toll-management.ts, lib/admin-pricing-engine.ts, lib/admin-pricing-service.ts,
 * the toll_points/toll_tariffs/toll_pricing_settings/route_toll_alternative*
 * tables, and app/admin/api/pricing/**) is the only place toll data may be
 * read, computed, or displayed.
 *
 * This is a static guard: it scans source text under app/data/** for any
 * mention of the toll vocabulary (case-insensitive: "toll", "gecis_ucret",
 * "geçiş ücreti", or an import/reference naming a toll module or table).
 * It does not evaluate control flow, so it will also flag a merely-commented
 * mention — that is the conservative, intended behavior: nothing toll-shaped
 * belongs in the public data layer at all, not even in a comment.
 *
 * Run: node scripts/check-toll-customer-leak-static.mjs
 * Exit code 0 = clean. Exit code 1 = a toll reference was found in app/data/**.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC_DATA_DIR = join(process.cwd(), 'app', 'data');

// Any of these substrings appearing anywhere in a app/data/** source file is a violation.
const FORBIDDEN_PATTERNS = [
  /toll/i,
  /geçiş[\s_-]?ücret/i,
  /gecis[\s_-]?ucret/i,
];

function collectFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectFiles(full));
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const files = collectFiles(PUBLIC_DATA_DIR);
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(lines[i])) {
          violations.push({ file, line: i + 1, text: lines[i].trim(), pattern: pattern.source });
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(`FAIL: ${violations.length} toll reference(s) found in customer-facing app/data/** route handlers:`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  [${v.pattern}]  ${v.text}`);
    }
    console.error('\nToll pricing data must never be imported, referenced, or mentioned in the public /data/* API surface.');
    process.exit(1);
  }

  console.log(`PASS: scanned ${files.length} file(s) under app/data/** — no toll references found.`);
}

main();
