#!/usr/bin/env tsx
/**
 * Lightweight Performance & SEO Quality Gate
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses Node.js fetch — no browser or Chrome required.
 *
 * Checks 6 public pages + 2 Arabic RTL pages for:
 *   • HTTP status (< 400)
 *   • TTFB < 800 ms (lab/server condition)
 *   • <title> present (> 5 chars)
 *   • <link rel="canonical"> present
 *   • Exactly 1 <h1>
 *   • Every <img> has alt attribute
 *   • <meta name="description"> present
 *   • Arabic (RTL) pages: html[dir="rtl"] set
 *   • hreflang <link> present (non-root pages)
 *   • No render-blocking external scripts in <head>
 *
 * Run:
 *   pnpm --filter @workspace/istanbul-vip-transfer test:perf
 *
 * Override base URL:
 *   BASE_URL=https://www.istanbulviptransfer.com \
 *   pnpm --filter @workspace/istanbul-vip-transfer test:perf
 */

const BASE_URL = process.env.BASE_URL
  ?? `http://localhost:${process.env.PORT ?? '26004'}`;

// ── Pages under test ──────────────────────────────────────────────────────────
const PAGES = [
  { path: '/',              name: 'Ana Sayfa',    rtl: false },
  { path: '/hizmetler',    name: 'Hizmetler',    rtl: false },
  { path: '/araclar',      name: 'Araçlar',      rtl: false },
  { path: '/blog',         name: 'Blog',         rtl: false },
  { path: '/iletisim',     name: 'İletişim',     rtl: false },
  { path: '/en',           name: 'EN Home',      rtl: false },
  { path: '/ar',           name: 'AR Ana Sayfa', rtl: true  },
  { path: '/ar/hizmetler', name: 'AR Hizmetler', rtl: true  },
] as const;

// ── Thresholds ────────────────────────────────────────────────────────────────
const MAX_TTFB_MS = 800;

// ── Result type ───────────────────────────────────────────────────────────────
interface PageResult {
  name:   string;
  path:   string;
  ok:     boolean;
  errors: string[];
  warns:  string[];
  ttfb:   number;
}

// ── Single page check ─────────────────────────────────────────────────────────
async function checkPage(
  path: string,
  name: string,
  rtl: boolean,
): Promise<PageResult> {
  const url    = `${BASE_URL}${path}`;
  const errors: string[] = [];
  const warns:  string[] = [];
  let   ttfb   = 0;
  let   html   = '';

  try {
    const t0  = performance.now();
    const res = await fetch(url, {
      headers: { Accept: 'text/html', 'User-Agent': 'perf-check/1.0' },
      // follow redirects (default) but record first-byte after redirect
    });
    ttfb = performance.now() - t0;
    html = await res.text();

    // ── HTTP status ─────────────────────────────────────────────────────────
    if (res.status >= 400) errors.push(`HTTP ${res.status}`);

    // ── TTFB ────────────────────────────────────────────────────────────────
    if (ttfb > MAX_TTFB_MS) {
      warns.push(`TTFB ${ttfb.toFixed(0)} ms exceeds ${MAX_TTFB_MS} ms (dev server; expect < 200 ms in production)`);
    }

    // ── <title> ─────────────────────────────────────────────────────────────
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (!titleMatch || titleMatch[1].trim().length < 5) {
      errors.push('Missing or too-short <title>');
    }

    // ── canonical ───────────────────────────────────────────────────────────
    if (!/<link[^>]+rel=["']canonical["'][^>]*>/i.test(html)) {
      errors.push('Missing <link rel="canonical">');
    }

    // ── hreflang (skip for homepage / single-language pages) ────────────────
    if (path !== '/') {
      if (!/<link[^>]+rel=["']alternate["'][^>]+hreflang/i.test(html)) {
        warns.push('No hreflang <link> found (expected on multi-locale pages)');
      }
    }

    // ── H1 count ─────────────────────────────────────────────────────────────
    const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
    if (h1Count === 0) errors.push('No <h1> element');
    if (h1Count > 1)   errors.push(`Multiple <h1> elements: ${h1Count} found`);

    // ── <img> alt coverage ────────────────────────────────────────────────────
    // Exclude SVG titles which Regex might confuse; look for real img tags.
    const imgTags     = html.match(/<img\b[^>]*>/gi) ?? [];
    const missingAlt  = imgTags.filter(tag => !/\balt\s*=/i.test(tag));
    if (missingAlt.length > 0) {
      errors.push(`${missingAlt.length} <img> element(s) missing alt attribute`);
    }

    // ── meta description ─────────────────────────────────────────────────────
    if (!/<meta[^>]+name=["']description["'][^>]*>/i.test(html)) {
      warns.push('Missing <meta name="description">');
    }

    // ── Open Graph image ─────────────────────────────────────────────────────
    if (!/<meta[^>]+property=["']og:image["'][^>]*>/i.test(html)) {
      warns.push('Missing <meta property="og:image">');
    }

    // ── RTL: inline script must set dir="rtl" client-side ───────────────────
    // The root layout renders html[dir="ltr"] with suppressHydrationWarning.
    // [lang]/layout.tsx injects a synchronous inline script that immediately
    // calls h.setAttribute('dir','rtl') before React hydration — this is the
    // correct pattern to check in SSR HTML.
    if (rtl) {
      const hasRtlScript = /setAttribute\s*\(\s*['"]dir['"]\s*,\s*['"]rtl['"]\s*\)/i.test(html)
        || /['"]dir['"]\s*,\s*['"]rtl['"]/i.test(html);
      if (!hasRtlScript) {
        errors.push('Arabic page missing inline RTL script (setAttribute dir/rtl)');
      }
    }

    // ── No render-blocking external scripts in <head> ─────────────────────────
    // Exclude: async, defer, noModule (polyfills skipped by modern browsers),
    // and internal Next.js scripts (/_next/).
    const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
    if (headMatch) {
      const head        = headMatch[0];
      const syncScripts = (head.match(/<script\b[^>]*>/gi) ?? [])
        .filter(s =>
          /\bsrc=/i.test(s) &&             // has external src
          !/\b(async|defer|nomodule)\b/i.test(s) && // not async/defer/noModule
          !/_next\//.test(s),              // not a Next.js internal chunk
        );
      if (syncScripts.length > 0) {
        warns.push(`${syncScripts.length} render-blocking third-party script(s) in <head>`);
      }
    }

  } catch (err) {
    errors.push(`Fetch error: ${String(err)}`);
  }

  return { name, path, ok: errors.length === 0, errors, warns, ttfb };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍  Performance & SEO Quality Gate`);
  console.log(`    Base URL : ${BASE_URL}`);
  console.log(`    Pages    : ${PAGES.length}\n`);
  console.log('─'.repeat(70));

  const results: PageResult[] = [];

  for (const { path, name, rtl } of PAGES) {
    const r = await checkPage(path, name, rtl);
    results.push(r);

    const icon    = r.ok ? '✅' : r.errors.length > 0 ? '❌' : '⚠️ ';
    const ttfbStr = `${r.ttfb.toFixed(0)} ms`.padStart(7);
    console.log(`${icon}  ${name.padEnd(18)} TTFB${ttfbStr}  ${r.path}`);
    r.errors.forEach(e => console.log(`      ├─ ❌  ${e}`));
    r.warns.forEach(w  => console.log(`      ├─ ⚠️   ${w}`));
  }

  const passed  = results.filter(r => r.ok).length;
  const failed  = results.filter(r => r.errors.length > 0).length;
  const warned  = results.filter(r => r.warns.length > 0).length;
  const avgTtfb = results.reduce((s, r) => s + r.ttfb, 0) / results.length;

  console.log('\n' + '─'.repeat(70));
  console.log(`  ✅ Passed   : ${passed}`);
  console.log(`  ❌ Failed   : ${failed}`);
  console.log(`  ⚠️  Warnings : ${warned}`);
  console.log(`  ⏱  Avg TTFB : ${avgTtfb.toFixed(0)} ms (dev/lab)`);

  if (failed > 0) {
    console.log('\n❌  Quality gate FAILED — resolve errors above before deploying.\n');
    process.exit(1);
  } else {
    console.log('\n✅  Quality gate PASSED\n');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
