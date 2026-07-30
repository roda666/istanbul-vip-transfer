/**
 * POST /admin/api/homepage/[locale]/publish  — publish locale content
 * POST /admin/api/homepage/[locale]/unpublish — unpublish (revert to DRAFT)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

const VALID_LOCALES = ['tr', 'en', 'de', 'ru', 'ar'] as const;
const HOMEPAGE_SLUG = 'ana-sayfa';

const LOCALE_PATHS: Record<string, string> = {
  tr: '/',
  en: '/en',
  de: '/de',
  ru: '/ru',
  ar: '/ar',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { locale } = await params;
  if (!(VALID_LOCALES as readonly string[]).includes(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action') ?? 'publish';
  const isApprove = action === 'approve';
  const isPublish = action !== 'unpublish' && !isApprove;

  try {
    const { db } = await import('@/db');
    const { content, contentTranslations, auditLogs } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    const now = new Date();

    if (locale === 'tr') {
      const [row] = await db
        .select({ id: content.id })
        .from(content)
        .where(eq(content.slug, HOMEPAGE_SLUG))
        .limit(1);

      if (!row) return NextResponse.json({ error: 'No content to publish' }, { status: 404 });

      await db
        .update(content)
        .set({
          status: isPublish ? 'PUBLISHED' : 'DRAFT',
          publishedAt: isPublish ? now : null,
          approvedAt: isPublish ? now : null,
          approvedBy: isPublish ? session.adminId : null,
          updatedAt: now,
        })
        .where(eq(content.id, row.id));

      await db.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: isPublish ? 'HOMEPAGE_PUBLISH' : 'HOMEPAGE_UNPUBLISH',
        entityType: 'homepage',
        entityId: row.id,
        metadata: { locale },
      });
    } else {
      const [src] = await db
        .select({ id: content.id })
        .from(content)
        .where(eq(content.slug, HOMEPAGE_SLUG))
        .limit(1);

      if (!src) return NextResponse.json({ error: 'Source record not found' }, { status: 404 });

      const [tx] = await db
        .select({ id: contentTranslations.id })
        .from(contentTranslations)
        .where(
          and(
            eq(contentTranslations.entityType, 'homepage'),
            eq(contentTranslations.entityId, src.id),
            eq(contentTranslations.targetLanguageCode, locale),
          ),
        )
        .limit(1);

      if (!tx) return NextResponse.json({ error: 'No translation to publish' }, { status: 404 });

      let newStatus: 'PUBLISHED' | 'DRAFT' | 'APPROVED';
      if (isApprove) newStatus = 'APPROVED';
      else if (isPublish) newStatus = 'PUBLISHED';
      else newStatus = 'DRAFT';

      await db
        .update(contentTranslations)
        .set({
          status: newStatus,
          publishedAt: isPublish ? now : null,
          approvedAt: (isPublish || isApprove) ? now : null,
          approvedBy: (isPublish || isApprove) ? session.adminId : null,
          updatedAt: now,
          updatedBy: session.adminId,
        })
        .where(eq(contentTranslations.id, tx.id));

      await db.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: isApprove ? 'HOMEPAGE_TRANSLATION_APPROVE' : isPublish ? 'HOMEPAGE_PUBLISH' : 'HOMEPAGE_UNPUBLISH',
        entityType: 'homepage',
        entityId: src.id,
        metadata: { locale },
      });
    }

    // Revalidate the affected public route
    const path = LOCALE_PATHS[locale] ?? '/';
    revalidatePath(path);

    return NextResponse.json({ ok: true, action, locale });
  } catch (err) {
    console.error('Homepage publish error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 503 });
  }
}
