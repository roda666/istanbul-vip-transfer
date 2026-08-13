/**
 * POST /admin/api/homepage/bulk-publish
 *
 * Publishes all APPROVED translation locales in one request.
 * Skips locales that are not APPROVED.
 * Calls revalidatePath for each published locale.
 *
 * Locale list is catalog-driven (isEnabled + providerSupported non-TR rows).
 * Body: { locales?: string[] }  — if omitted defaults to all catalog targets.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { HOMEPAGE_SLUG } from '@/lib/homepage-cms';
import { revalidatePath } from 'next/cache';
import 'server-only';

const schema = z.object({
  locales: z.array(z.string().min(2).max(10)).optional(),
});

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  const { db } = await import('@/db');
  const { content, contentTranslations, auditLogs, languages } = await import('@/db/schema');
  const { eq, and, inArray } = await import('drizzle-orm');

  // Catalog-driven target locale list
  const enabledRows = await db
    .select({ code: languages.code })
    .from(languages)
    .where(and(eq(languages.isEnabled, true), eq(languages.providerSupported, true)));
  const catalogLocales = enabledRows.map(r => r.code).filter(c => c !== 'tr');

  // If caller provided explicit list, intersect with catalog (prevents arbitrary locale injection)
  const targetLocales =
    parsed.success && parsed.data.locales
      ? parsed.data.locales.filter(c => catalogLocales.includes(c))
      : catalogLocales;

  const [src] = await db.select({ id: content.id }).from(content).where(eq(content.slug, HOMEPAGE_SLUG)).limit(1);
  if (!src) return NextResponse.json({ error: 'Source record not found' }, { status: 404 });

  const txRows = await db.select({
    id: contentTranslations.id,
    targetLanguageCode: contentTranslations.targetLanguageCode,
    status: contentTranslations.status,
  }).from(contentTranslations).where(
    and(
      eq(contentTranslations.entityType, 'homepage'),
      eq(contentTranslations.entityId, src.id),
      inArray(contentTranslations.targetLanguageCode, targetLocales.length > 0 ? targetLocales : ['']),
    ),
  );

  const now = new Date();
  const results: Record<string, 'published' | 'skipped' | 'error'> = {};

  for (const tx of txRows) {
    if (tx.status !== 'APPROVED') {
      results[tx.targetLanguageCode] = 'skipped';
      continue;
    }

    try {
      await db.update(contentTranslations).set({
        status: 'PUBLISHED',
        publishedAt: now,
        approvedAt: now,
        approvedBy: session.adminId,
        updatedAt: now, updatedBy: session.adminId,
      }).where(eq(contentTranslations.id, tx.id));

      await db.insert(auditLogs).values({
        adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_PUBLISH',
        entityType: 'content_translation', entityId: tx.id,
        metadata: { locale: tx.targetLanguageCode, bulkPublish: true },
      });

      revalidatePath(`/${tx.targetLanguageCode}`);

      results[tx.targetLanguageCode] = 'published';
    } catch {
      results[tx.targetLanguageCode] = 'error';
    }
  }

  // Fill in locales that had no DB row
  for (const locale of targetLocales) {
    if (!results[locale]) results[locale] = 'skipped';
  }

  return NextResponse.json({ ok: true, results });
}
