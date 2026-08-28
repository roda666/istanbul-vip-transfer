/**
 * check-service-health.ts
 *
 * Standalone CLI guard: lists every Service-type slug in lib/page-registry.ts
 * that has ZERO rows in the content table (not even a DRAFT). A Service slug
 * uses ServicePageRenderer, which is entirely DB-driven — unlike WebPage
 * slugs (guarded at build time by check-page-meta.ts), there is no static
 * React component to fall back on. If nobody ever publishes content for a
 * registered Service slug, every locale silently renders noindex with no
 * error — this script surfaces that before it reaches production.
 *
 * This mirrors the DB-independent logic used by the admin health check
 * (lib/service-page-health.ts, surfaced at /admin/hizmetler and via the
 * hourly service-health-scheduler), so a developer can also run it locally
 * or in CI without needing to load the admin panel.
 *
 * Run via:  pnpm --filter @workspace/istanbul-vip-transfer check:service-health
 *
 * NOT wired into `prebuild` — it requires a live DB connection, and prebuild
 * must not fail a deploy just because the DB is momentarily unreachable.
 * Run it manually after adding a new Service slug to PAGE_REGISTRY.
 */
import { db } from '../db';
import { content } from '../db/schema';
import { eq } from 'drizzle-orm';
import { computeServiceHealthIssues, getRegisteredServiceSlugs, type ServiceDbRow } from '../lib/service-page-health';

async function main() {
  const registeredSlugs = getRegisteredServiceSlugs();

  const rows = await db
    .select({
      id:       content.id,
      slug:     content.slug,
      title:    content.title,
      status:   content.status,
      isActive: content.isActive,
      body:     content.body,
    })
    .from(content)
    .where(eq(content.contentType, 'SERVICE'));

  const dbRows: ServiceDbRow[] = rows.map(r => ({
    id:       r.id,
    slug:     r.slug,
    title:    r.title,
    status:   r.status,
    isActive: r.isActive,
    body:     r.body ?? null,
  }));

  const issues = computeServiceHealthIssues(registeredSlugs, dbRows);
  const missing = issues.filter(i => i.issues.includes('missing_record'));

  if (missing.length === 0) {
    console.log(`✓ All ${registeredSlugs.length} registered Service slugs have at least a draft CMS record.`);
    if (issues.length > 0) {
      console.log(`  (${issues.length} slug(s) have other health issues — see /admin/hizmetler for details.)`);
    }
    process.exit(0);
  }

  console.error(`✗ ${missing.length} Service slug(s) in PAGE_REGISTRY have NO CMS record at all (not even a draft):`);
  for (const m of missing) {
    console.error(`  - ${m.slug}`);
  }
  console.error('\nEvery locale for these slugs currently renders noindex with no visible error.');
  console.error('Create at least a draft in the CMS (e.g. via /admin/hizmetler/yeni) to resolve.');
  process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
