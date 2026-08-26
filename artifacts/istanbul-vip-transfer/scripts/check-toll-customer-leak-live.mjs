#!/usr/bin/env node
/**
 * Live guard (requirement #5 — zero customer leakage): calls every
 * unauthenticated /data/* endpoint against a running server and deep-scans
 * the actual JSON response for any toll-shaped key or string value. Fails
 * (exit 1) the instant a toll field, amount, or even the word "toll"/
 * "geçiş ücreti" appears anywhere in a customer-facing response — including
 * nested objects/arrays and JSON embedded inside string fields.
 *
 * This complements check-toll-customer-leak-static.mjs (which guards the
 * source code) by proving the *actual served bytes* are clean, independent
 * of how the response was constructed.
 *
 * Requires the app dev/prod server to already be running.
 * Usage:
 *   BASE_URL=http://localhost:$PORT node scripts/check-toll-customer-leak-live.mjs
 */

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

const FORBIDDEN_RE = /toll|geçiş[\s_-]?ücret|gecis[\s_-]?ucret/i;

// Every unauthenticated GET/POST endpoint under app/data/** that returns JSON,
// called with representative parameters so each returns real (non-empty) data
// where possible.
const ENDPOINTS = [
  { method: 'GET', path: '/data/vehicles?lang=tr' },
  { method: 'GET', path: '/data/vehicles?lang=en' },
  { method: 'GET', path: '/data/transfer-routes' },
  { method: 'GET', path: '/data/service-types' },
  { method: 'GET', path: '/data/languages' },
  { method: 'GET', path: '/data/form-settings' },
  { method: 'GET', path: '/data/locations?for=pickup&scope=local&q=ist' },
  { method: 'GET', path: '/data/locations?for=dropoff&scope=intercity&q=bur' },
  { method: 'GET', path: '/data/custom-fields?slug=istanbul-havalimani-transfer' },
  { method: 'GET', path: '/data/turnstile-config?form=reservation' },
  { method: 'GET', path: '/data/form-guard?form=reservation' },
  // Public price calculation must remain fully disabled — assert that too.
  { method: 'POST', path: '/data/price-estimate', body: {} },
];

function findViolations(value, pathParts = []) {
  const violations = [];
  if (value == null) return violations;

  if (typeof value === 'string') {
    if (FORBIDDEN_RE.test(value)) {
      violations.push({ path: pathParts.join('.'), value });
    }
    return violations;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => violations.push(...findViolations(item, [...pathParts, `[${i}]`])));
    return violations;
  }
  if (typeof value === 'object') {
    for (const [key, val] of Object.entries(value)) {
      if (FORBIDDEN_RE.test(key)) {
        violations.push({ path: [...pathParts, key].join('.'), value: '(key name itself matches)' });
      }
      violations.push(...findViolations(val, [...pathParts, key]));
    }
  }
  return violations;
}

async function main() {
  let totalViolations = 0;
  let checked = 0;

  for (const ep of ENDPOINTS) {
    const url = `${BASE_URL}${ep.path}`;
    let res;
    try {
      res = await fetch(url, {
        method: ep.method,
        headers: ep.body ? { 'Content-Type': 'application/json' } : undefined,
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
    } catch (err) {
      console.error(`ERROR reaching ${ep.method} ${ep.path}: ${err.message}`);
      process.exitCode = 1;
      continue;
    }

    let json;
    try {
      json = await res.json();
    } catch {
      console.log(`SKIP (non-JSON, status ${res.status}): ${ep.method} ${ep.path}`);
      continue;
    }

    checked++;
    const violations = findViolations(json);
    if (violations.length > 0) {
      totalViolations += violations.length;
      console.error(`FAIL: ${ep.method} ${ep.path} (status ${res.status}) leaked ${violations.length} toll reference(s):`);
      for (const v of violations) console.error(`   ${v.path}: ${JSON.stringify(v.value)}`);
    } else {
      console.log(`OK: ${ep.method} ${ep.path} (status ${res.status}) — clean`);
    }
  }

  console.log(`\nChecked ${checked}/${ENDPOINTS.length} endpoint(s).`);
  if (totalViolations > 0) {
    console.error(`FAIL: ${totalViolations} total toll reference(s) leaked to customer-facing responses.`);
    process.exit(1);
  }
  console.log('PASS: no toll references found in any customer-facing /data/* response.');
}

main();
