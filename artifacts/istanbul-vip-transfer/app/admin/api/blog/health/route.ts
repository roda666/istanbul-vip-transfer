/**
 * GET /admin/api/blog/health
 *
 * Returns a health report for all blog slugs declared in blog-data.ts.
 * Flags every slug that has at least one problem:
 *
 *   - missing_source_record     → no BLOG_POST row in content table (translations
 *                                  cannot be linked without an entity_id)
 *   - missing_translation       → one or more non-TR locales (en/de/ru/ar) have
 *                                  no contentTranslations row for this post
 *   - translation_not_published → a translation row exists but status != 'PUBLISHED'
 *
 * The Turkish source route (/blog/[slug]) reads from static blog-data.ts and
 * cannot silently go offline; only the localized routes (/en/blog/…, etc.)
 * depend on DB translation records, so health targets those.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import {
  computeBlogHealthIssues,
  getKnownBlogSlugs,
  getTranslationLocales,
  type BlogSourceRow,
  type BlogTranslationRow,
  type BlogHealthReport,
} from '@/lib/blog-health';
import 'server-only';

export async function GET() {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db }                          = await import('@/db');
    const { content, contentTranslations } = await import('@/db/schema');
    const { eq, inArray }                  = await import('drizzle-orm');

    // Fetch all BLOG_POST source records
    const rawSources = await db
      .select({ id: content.id, slug: content.slug, title: content.title })
      .from(content)
      .where(eq(content.contentType, 'BLOG_POST'));

    const sourceRows: BlogSourceRow[] = rawSources.map(r => ({
      id:    r.id,
      slug:  r.slug,
      title: r.title,
    }));

    // Fetch contentTranslations for all BLOG_POST entities
    const entityIds = sourceRows.map(r => r.id);
    const rawTranslations = entityIds.length > 0
      ? await db
          .select({
            entityId:           contentTranslations.entityId,
            targetLanguageCode: contentTranslations.targetLanguageCode,
            status:             contentTranslations.status,
          })
          .from(contentTranslations)
          .where(inArray(contentTranslations.entityId, entityIds))
      : [];

    const translationRows: BlogTranslationRow[] = rawTranslations.map(r => ({
      entityId:           r.entityId!,
      targetLanguageCode: r.targetLanguageCode,
      status:             r.status,
    }));

    const knownSlugs  = getKnownBlogSlugs();
    const checkLocales = getTranslationLocales();
    const unhealthy   = computeBlogHealthIssues(knownSlugs, sourceRows, translationRows, checkLocales);

    const report: BlogHealthReport = {
      checkedAt:        new Date().toISOString(),
      knownCount:       knownSlugs.length,
      dbCount:          sourceRows.length,
      translationCount: translationRows.length,
      unhealthyCount:   unhealthy.length,
      items:            unhealthy,
    };

    return NextResponse.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'DB error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
