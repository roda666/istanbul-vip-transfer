#!/usr/bin/env node
/**
 * Build-time guard: every `redirects()` rule in next.config.ts must point at a
 * destination that actually resolves — not another dead end.
 *
 * A redirect whose destination itself 404s is worse than no redirect at all:
 * it silently swallows the accumulated ranking/backlink authority of the old
 * URL into a page that doesn't exist, instead of surfacing the problem.
 * (Found 2026-08-27 audit: legacy-URL redirect map had never been checked
 * against the current route set; slugs drift over time as pages are renamed.)
 *
 * This imports the SAME `redirects()` function Next.js uses at request time
 * (via tsx-transpiled dynamic import of next.config.ts), so the check can
 * never drift out of sync with the real rule list.
 *
 * For each rule's destination pathname (query stripped):
 *   • '/'                          → always valid (homepage)
 *   • one of the 4 static CMS-free pages (hizmetler/araclar/hakkimizda/iletisim)
 *     → always valid
 *   • '/admin/...'                 → valid if the matching app/admin page file exists
 *     (auth-gated routes can't be probed for a real 200, so file existence is
 *     the correct proxy — the route itself is what must not have vanished)
 *   • '/blog/<slug>'                → valid if a PUBLISHED BLOG_POST content row
 *     with that slug exists
 *   • bare top-level slug           → valid if app/<slug>/page.tsx exists on disk
 *     (this project's services are hand-authored static folders per slug, not
 *     a generic [slug] catch-all route)
 *   • dynamic pattern segments (:lang, :slug, :path*) → cannot be resolved to
 *     one destination at build time. `:lang` alone is expanded against every
 *     locale literal in the matching source pattern and checked against the
 *     active language catalog. Passthrough patterns (`:lang/:slug`, `:path*`)
 *     are structurally sound by construction (they forward the incoming
 *     path unchanged) and are reported as informational, not failures.
 *
 * Run: node scripts/check-redirect-destinations.mjs (auto-transpiles next.config.ts)
 * Exit code 0 = clean. Exit code 1 = at least one dead-end destination found.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from '../node_modules/postgres/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT, 'app');

const ALWAYS_VALID_STATIC = ['hizmetler', 'araclar', 'hakkimizda', 'iletisim'];

function stripToPathname(destination) {
  let p = destination
    .replace(/^https:\/\/www\.istanbulviptransfer\.com/, '')
    .replace(/^https:\/\/istanbulviptransfer\.com/, '');
  const qIdx = p.indexOf('?');
  if (qIdx !== -1) p = p.slice(0, qIdx);
  if (p === '') p = '/';
  return p;
}

/** Resolve an /admin/... pathname to its page.tsx file, trying both the
 *  (protected) route group and the unprotected admin root. */
function findAdminPageFile(pathname) {
  const rel = pathname.replace(/^\/admin\//, '');
  const candidates = [
    path.join(APP_DIR, 'admin', '(protected)', rel, 'page.tsx'),
    path.join(APP_DIR, 'admin', rel, 'page.tsx'),
  ];
  return candidates.find((f) => fs.existsSync(f)) ?? null;
}

async function loadRedirectRules() {
  // next.config.ts has no Next.js-runtime-specific syntax in redirects() —
  // it's plain TS/JS — so tsx can import it directly like any other module.
  const { default: nextConfig } = await import('../next.config.ts');
  if (typeof nextConfig.redirects !== 'function') {
    throw new Error('next.config.ts has no redirects() export — check the file was not restructured.');
  }
  return nextConfig.redirects();
}

async function main() {
  const rules = await loadRedirectRules();
  const sql = postgres(process.env.DATABASE_URL);

  const failures = [];
  const info = [];
  let checked = 0;

  for (const rule of rules) {
    const pathname = stripToPathname(rule.destination);

    // ── Dynamic pattern destinations ──────────────────────────────────────
    if (pathname.includes(':')) {
      if (pathname === '/:lang') {
        const langMatch = rule.source.match(/:lang\(([^)]+)\)/);
        const locales = langMatch ? langMatch[1].split('|') : [];
        // Same predicate as getPublicLanguages() (lib/i18n/active-locales.ts).
        const rows = await sql`SELECT code FROM languages WHERE is_enabled = true AND is_published = true`;
        const active = new Set(['tr', ...rows.map((r) => r.code)]);
        for (const locale of locales) {
          checked++;
          if (!active.has(locale)) {
            failures.push(
              `${rule.source} → ${rule.destination}: locale "${locale}" is not in the active language catalog.`,
            );
          }
        }
      } else {
        // Passthrough patterns (:lang/:slug, :path*) forward the incoming
        // path unchanged — structurally valid by construction.
        info.push(`${rule.source} → ${rule.destination} (passthrough pattern, not individually checked)`);
      }
      continue;
    }

    checked++;

    // ── Homepage / always-static pages ────────────────────────────────────
    if (pathname === '/') continue;
    const staticSlug = pathname.replace(/^\//, '');
    if (ALWAYS_VALID_STATIC.includes(staticSlug)) continue;

    // ── Admin routes ───────────────────────────────────────────────────────
    if (pathname.startsWith('/admin/')) {
      const file = findAdminPageFile(pathname);
      if (!file) {
        failures.push(`${rule.source} → ${rule.destination}: no matching app/admin page file for "${pathname}".`);
      }
      continue;
    }

    // ── Blog posts ─────────────────────────────────────────────────────────
    if (pathname.startsWith('/blog/')) {
      const slug = pathname.replace('/blog/', '');
      const rows = await sql`
        SELECT 1 FROM content
        WHERE content_type = 'BLOG_POST' AND status = 'PUBLISHED' AND slug = ${slug}
        LIMIT 1
      `;
      if (rows.length === 0) {
        failures.push(`${rule.source} → ${rule.destination}: no PUBLISHED blog post with slug "${slug}".`);
      }
      continue;
    }

    // ── Bare top-level slug (hand-authored static service page folder) ────
    const pageFile = path.join(APP_DIR, staticSlug, 'page.tsx');
    if (!fs.existsSync(pageFile)) {
      failures.push(`${rule.source} → ${rule.destination}: no app/${staticSlug}/page.tsx on disk.`);
    }
  }

  await sql.end();

  if (failures.length > 0) {
    console.error(`\n✗  redirect-destination check FAILED — ${failures.length} dead-end destination(s):\n`);
    for (const f of failures) console.error(`   • ${f}`);
    console.error(
      `\nFix: update the destination in next.config.ts to the current correct path, or remove the rule if it ` +
        `no longer applies. Do not leave a redirect pointing at a page that no longer exists.\n`,
    );
    process.exit(1);
  }

  console.log(
    `✓  redirect-destination check OK — ${checked} destination(s) checked across ${rules.length} rule(s), ` +
      `${info.length} passthrough pattern(s) skipped by design`,
  );
}

main().catch((err) => {
  console.error('redirect-destination check crashed:', err);
  process.exit(1);
});
