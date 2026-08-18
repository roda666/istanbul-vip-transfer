/**
 * Quick smoke-test for Google Ads Keyword Planner integration.
 * Usage: node scripts/test-keyword-planner.mjs
 * Requires env: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 *               GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_LOGIN_CUSTOMER_ID
 */
import postgres from '../node_modules/postgres/src/index.js';

const devToken    = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const loginCustId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
const clientId    = process.env.GOOGLE_CLIENT_ID;
const clientSecret= process.env.GOOGLE_CLIENT_SECRET;
const dbUrl       = process.env.DATABASE_URL;

if (!devToken || !loginCustId || !clientId || !clientSecret || !dbUrl) {
  console.error('❌ One or more required env vars missing.');
  process.exit(1);
}

// ── 1. Fetch stored tokens from DB ────────────────────────────────────────────
const sql = postgres(dbUrl, { ssl: 'require', max: 1 });
const rows = await sql`SELECT access_token, refresh_token, token_expiry FROM google_ads_connections ORDER BY id DESC LIMIT 1`;

if (!rows.length) {
  console.log('⚠️  No Google Ads connection found in DB.');
  console.log('   → OAuth bağlantısı henüz yapılmamış. Admin panelinden Google ile bağlanın.');
  await sql.end();
  process.exit(0);
}

const { access_token, refresh_token, token_expiry } = rows[0];
console.log('✅ DB connection found, email check skipped.');

// ── 2. Auto-refresh if expired ────────────────────────────────────────────────
let accessToken = access_token;
const expiry    = token_expiry ? new Date(token_expiry) : null;
if (!accessToken || !expiry || expiry <= new Date(Date.now() + 60_000)) {
  console.log('🔄 Token expired — refreshing…');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type:'refresh_token', refresh_token, client_id:clientId, client_secret:clientSecret }),
  });
  if (!res.ok) { console.error('❌ Token refresh failed:', res.status, await res.text()); await sql.end(); process.exit(1); }
  const data = await res.json();
  accessToken = data.access_token;
  console.log('✅ Token refreshed.');
}

// ── 3. Call Keyword Planner ───────────────────────────────────────────────────
const customerId = loginCustId.replace(/-/g, '');
const seeds = ['istanbul vip transfer', 'istanbul havalimanı transfer', 'sabiha gökçen transfer'];
console.log(`\n🔍 Testing Keyword Planner for seeds: ${seeds.join(', ')}\n`);

const kpRes = await fetch(
  `https://googleads.googleapis.com/v18/customers/${customerId}:generateKeywordIdeas`,
  {
    method:  'POST',
    headers: {
      Authorization:       `Bearer ${accessToken}`,
      'developer-token':   devToken,
      'login-customer-id': loginCustId,
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      keywordSeed:         { keywords: seeds },
      geoTargetConstants:  ['geoTargetConstants/2792'],
      language:            'languageConstants/1011',
      keywordPlanNetwork:  'GOOGLE_SEARCH',
      includeAdultKeywords: false,
    }),
  },
);

if (!kpRes.ok) {
  const txt = await kpRes.text();
  console.error('❌ Keyword Planner API error:', kpRes.status);
  // Strip token from output for safety
  console.error(txt.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').slice(0, 800));
  await sql.end();
  process.exit(1);
}

const data = await kpRes.json();
const ideas = (data.results ?? [])
  .map(r => ({
    keyword:    r.text,
    monthly:    parseInt(r.keywordIdeaMetrics?.avgMonthlySearches ?? '0', 10),
    competition: r.keywordIdeaMetrics?.competition ?? '—',
  }))
  .filter(i => i.monthly > 0)
  .sort((a, b) => b.monthly - a.monthly)
  .slice(0, 15);

if (!ideas.length) {
  console.log('⚠️  API responded OK but returned 0 results with search volume data.');
  console.log('   Raw result count:', data.results?.length ?? 0);
} else {
  console.log(`✅ Got ${ideas.length} keyword ideas (top 15 by monthly searches):\n`);
  const maxLen = Math.max(...ideas.map(i => i.keyword.length));
  console.log(`${'KEYWORD'.padEnd(maxLen)}  MONTHLY  COMPETITION`);
  console.log('─'.repeat(maxLen + 24));
  for (const i of ideas) {
    const m = i.monthly.toLocaleString('tr-TR').padStart(7);
    console.log(`${i.keyword.padEnd(maxLen)}  ${m}  ${i.competition}`);
  }
}

await sql.end();
