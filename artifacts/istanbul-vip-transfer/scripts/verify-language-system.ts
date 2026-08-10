/**
 * Integration checks for the language catalog system.
 * Run against a live dev server:  npx tsx scripts/verify-language-system.ts
 *
 * Covers:
 *  - public language set is exactly tr/en/de/ru/ar
 *  - passive locale URLs redirect safely (cookie reset, no loop)
 *  - sitemap contains only public locales
 *  - locale switch rejects passive locales
 *  - catalog invariants in the DB (TR default+locked state, idempotent seed counts)
 *  - enabling a catalog locale does NOT leak it publicly while unpublished/unrenderable
 */
import 'dotenv/config';
import postgres from 'postgres';

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:26004';
const EXPECTED_PUBLIC = ['tr', 'en', 'de', 'ru', 'ar'];

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  // 1. Public language endpoint
  const langsRes = await fetch(`${BASE}/data/languages`);
  const langs = (await langsRes.json()) as { items: Array<{ code: string }> };
  const codes = langs.items.map((l) => l.code).sort();
  check('public set is exactly tr/en/de/ru/ar', JSON.stringify(codes) === JSON.stringify([...EXPECTED_PUBLIC].sort()), codes.join(','));

  // 2. Passive locale URL → safe redirect chain ending at 200, no loop
  const fr = await fetch(`${BASE}/fr`, { redirect: 'manual' });
  const loc1 = fr.headers.get('location') ?? '';
  check('/fr redirects (307)', fr.status === 307, `-> ${loc1}`);
  const reset = await fetch(new URL(loc1, BASE), { redirect: 'manual' });
  const setsCookie = (reset.headers.get('set-cookie') ?? '').includes('ivt_lang_pref=tr');
  check('reset route clears lang cookie to tr and 303s to /', reset.status === 303 && setsCookie);
  const final = await fetch(`${BASE}/`, { headers: { Cookie: 'ivt_lang_pref=tr' } });
  check('root renders after reset', final.status === 200);

  // 3. Loop safety: root with stale cookie for a DISABLED renderable lang would
  //    bounce to /{lang}; layout must send it to the cookie-reset route, not "/".
  //    (Simulated: /en with cookie is active today, so just assert /en is 200.)
  const en = await fetch(`${BASE}/en`);
  check('/en (active locale) renders', en.status === 200);

  // 4. Sitemap only contains public locales
  const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const smLangs = [...new Set([...sm.matchAll(/<loc>https?:\/\/[^/]+\/([a-z]{2})(?:\/|<)/g)].map((m) => m[1]))];
  const leaked = smLangs.filter((l) => !EXPECTED_PUBLIC.includes(l));
  check('sitemap leaks no non-public locale', leaked.length === 0, leaked.join(',') || 'clean');

  // 5. Locale switch rejects a passive locale
  const sw = await fetch(`${BASE}/data/locale/switch?locale=fr`, { redirect: 'manual' });
  check('locale switch rejects passive locale (400)', sw.status === 400);
  const swOk = await fetch(`${BASE}/data/locale/switch?locale=en`, { redirect: 'manual' });
  check('locale switch accepts active locale (redirect)', swOk.status >= 300 && swOk.status < 400);

  // 6. hreflang on /en contains only public locales
  const enHtml = await (await fetch(`${BASE}/en`)).text();
  const hl = [...new Set([...enHtml.matchAll(/hrefLang="([^"]+)"/gi)].map((m) => m[1]))];
  const hlLangs = hl.filter((h) => h !== 'x-default').map((h) => h.split('-')[0]);
  const hlLeaked = hlLangs.filter((l) => !EXPECTED_PUBLIC.includes(l));
  check('hreflang leaks no non-public locale', hlLeaked.length === 0, hl.join(','));

  // 7. DB invariants
  const [inv] = await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE is_enabled AND is_published)::int AS public,
           count(*) FILTER (WHERE code='tr' AND is_default AND is_enabled AND is_published)::int AS tr_ok,
           count(*) FILTER (WHERE NOT provider_supported AND (is_enabled OR is_published))::int AS bad_unsupported,
           count(*) FILTER (WHERE is_published AND NOT is_enabled)::int AS bad_pub_disabled
    FROM languages`;
  check('catalog has 60+ languages', inv.total >= 60, `total=${inv.total}`);
  check('exactly 5 public languages in DB', inv.public === 5);
  check('TR is default + enabled + published', inv.tr_ok === 1);
  check('no unsupported language enabled/published', inv.bad_unsupported === 0);
  check('no published-but-disabled language', inv.bad_pub_disabled === 0);

  // 8. Enabling a catalog language must NOT leak it publicly (unpublished).
  await sql`UPDATE languages SET is_enabled = true WHERE code = 'fr'`;
  try {
    const after = await fetch(`${BASE}/data/languages`);
    const afterCodes = ((await after.json()) as { items: Array<{ code: string }> }).items.map((l) => l.code);
    check('enabled-but-unpublished fr does not leak publicly', !afterCodes.includes('fr'));
    const fr2 = await fetch(`${BASE}/fr`, { redirect: 'manual' });
    check('/fr still redirects while enabled-but-unpublished', fr2.status === 307);
  } finally {
    await sql`UPDATE languages SET is_enabled = false, is_published = false WHERE code = 'fr'`;
  }

  // 9. Seed regression: re-seeding must preserve admin-managed state.
  //    Simulate an admin unpublishing 'de', re-run the seed, and verify the
  //    state survived (then restore).
  const { execSync } = await import('node:child_process');
  await sql`UPDATE languages SET is_published = false WHERE code = 'de'`;
  try {
    execSync('npx tsx db/seed-languages.ts', { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' });
    const [de] = await sql`SELECT is_published, is_enabled FROM languages WHERE code = 'de'`;
    check('re-seed preserves admin unpublish of a core language', de.is_published === false);
    const [tr] = await sql`SELECT is_default, is_enabled, is_published FROM languages WHERE code = 'tr'`;
    check('re-seed keeps TR default+enabled+published', tr.is_default && tr.is_enabled && tr.is_published);
    const [cnt] = await sql`SELECT count(*)::int AS total FROM languages`;
    check('re-seed creates no duplicate rows', cnt.total === inv.total);
  } finally {
    await sql`UPDATE languages SET is_published = true, is_enabled = true WHERE code = 'de'`;
  }

  await sql.end();
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
