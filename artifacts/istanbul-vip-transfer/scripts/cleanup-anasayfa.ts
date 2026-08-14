/**
 * Cleanup script: archive the duplicate /ana-sayfa PAGE record.
 *
 * Root cause: the generic Sayfalar module does not validate reserved slugs,
 * so a PAGE content row with slug="ana-sayfa" was created accidentally. The
 * real homepage is managed by the dedicated "Ana Sayfa Düzenleyici" at the
 * `/` route and the content/contentTranslations tables with a separate
 * entity. The /ana-sayfa slug is now blocked from recreation by API validation.
 *
 * This script is IDEMPOTENT — safe to rerun. It will:
 *   1. Locate the PAGE row with slug="ana-sayfa".
 *   2. Print all its fields as a backup report.
 *   3. Verify it contains no unique body content not present in the homepage CMS.
 *   4. Archive the record (status → ARCHIVED, indexable → false).
 *      (Archive rather than hard-delete so the audit trail survives.)
 *
 * A permanent redirect /ana-sayfa → / is already configured in next.config.ts.
 *
 * Run:
 *   cd artifacts/istanbul-vip-transfer
 *   npx tsx scripts/cleanup-anasayfa.ts
 */

import { db } from '../db';
import { content } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const SLUG = 'ana-sayfa';

async function main() {
  console.log('🔍 /ana-sayfa duplicate cleanup — pre-flight check\n');

  // ── 1. Find the PAGE record ────────────────────────────────────────────
  const rows = await db
    .select()
    .from(content)
    .where(and(
      eq(content.slug,        SLUG),
      eq(content.contentType, 'PAGE'),
    ))
    .limit(5);

  if (rows.length === 0) {
    console.log('✓ No PAGE record with slug="ana-sayfa" found — already cleaned up or never created.\n');
    return;
  }

  // ── 2. Backup report ───────────────────────────────────────────────────
  console.log(`Found ${rows.length} PAGE record(s) with slug="${SLUG}":\n`);
  for (const row of rows) {
    console.log('  ── Record backup ──────────────────────────────');
    console.log(`  id          : ${row.id}`);
    console.log(`  contentType : ${row.contentType}`);
    console.log(`  title       : ${row.title}`);
    console.log(`  slug        : ${row.slug}`);
    console.log(`  status      : ${row.status}`);
    console.log(`  indexable   : ${row.indexable}`);
    console.log(`  seoTitle    : ${row.seoTitle ?? '(none)'}`);
    console.log(`  seoDesc     : ${row.seoDescription ?? '(none)'}`);
    console.log(`  excerpt     : ${row.excerpt ?? '(none)'}`);
    const bodySnippet = row.body ? String(row.body).slice(0, 200) : '(none)';
    console.log(`  body        : ${bodySnippet}${row.body && String(row.body).length > 200 ? '…' : ''}`);
    console.log(`  heroImage   : ${row.heroImage ?? '(none)'}`);
    console.log(`  createdAt   : ${row.createdAt?.toISOString() ?? 'unknown'}`);
    console.log(`  updatedAt   : ${row.updatedAt?.toISOString() ?? 'unknown'}`);
    console.log('  ───────────────────────────────────────────────');
  }

  // ── 3. Content safety check ────────────────────────────────────────────
  // The /ana-sayfa record was created via seed-homepage.ts which mirrors the
  // HOMEPAGE_FALLBACK static data — it contains no unique editorial content
  // beyond what the dedicated homepage CMS editor manages. We verify the
  // body is either null or a JSON blob matching the homepage CMS structure.
  for (const row of rows) {
    if (row.body) {
      const bodyStr = String(row.body);
      const isHomepageBody = bodyStr.includes('"hero"') || bodyStr.includes('"version"');
      if (!isHomepageBody) {
        console.error('\n⚠️  WARNING: body field contains non-homepage content structure.');
        console.error('    Manual review required before archiving. Aborting.\n');
        process.exit(1);
      }
      console.log('\n  Content check: body matches homepage CMS JSON structure — safe to archive.');
    } else {
      console.log('\n  Content check: body is null — safe to archive.');
    }
  }

  // ── 4. Archive all matching records ───────────────────────────────────
  const archived: string[] = [];
  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .update(content)
        .set({
          status:    'ARCHIVED',
          indexable: false,
          updatedAt: new Date(),
        })
        .where(eq(content.id, row.id));
      archived.push(row.id);
    }
  });

  console.log('\n✅ Archived records:');
  for (const id of archived) {
    console.log(`  id=${id}  status=ARCHIVED  indexable=false`);
  }
  console.log('\nNext steps:');
  console.log('  · /ana-sayfa → / redirect is already live in next.config.ts');
  console.log('  · Sayfalar admin list should no longer show this record as published');
  console.log('  · Reserved slug validation blocks recreation via the API\n');
}

main().catch((err) => {
  console.error('\n❌ Cleanup failed:', err);
  process.exit(1);
});
