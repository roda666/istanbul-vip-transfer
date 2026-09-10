import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getAdminSessionErrorStatus, requireAdminSession } from '@/lib/auth/session';
import { hasAdminPermission } from '@/lib/auth/authorization';
import { db } from '@/db';
import { content, contentTranslations, languages, auditLogs } from '@/db/schema';
import { revalidatePublicServiceDetail } from '@/lib/homepage-revalidation';

const input = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch (error) {
    const status = getAdminSessionErrorStatus(error);
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Unauthorized' }, { status });
  }
  if (!hasAdminPermission(session.role, 'CONTENT_PUBLISH')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = input(body?.ids);

  const eligible = await db.select({
    id: contentTranslations.id,
    targetLanguageCode: contentTranslations.targetLanguageCode,
    slug: content.slug,
  }).from(contentTranslations)
    .innerJoin(content, and(
      eq(contentTranslations.entityType, 'service_page'),
      sql`${contentTranslations.entityId}::uuid = ${content.id}`,
      eq(content.status, 'PUBLISHED'),
      eq(content.isActive, true),
    ))
    .innerJoin(languages, and(
      eq(languages.code, contentTranslations.targetLanguageCode),
      eq(languages.isEnabled, true),
      eq(languages.isPublished, true),
    ))
    .where(and(
      ...(ids.length ? [inArray(contentTranslations.id, ids)] : []),
      inArray(contentTranslations.status, ['APPROVED', 'SCHEDULED']),
    ));

  const eligibleIds = eligible.map(row => row.id);
  if (eligibleIds.length) {
    await db.transaction(async (tx) => {
      await tx.update(contentTranslations).set({
        status: 'PUBLISHED',
        publishedAt: sql`now()`,
        updatedAt: sql`now()`,
        updatedBy: session.adminId,
      }).where(inArray(contentTranslations.id, eligibleIds));
      await tx.insert(auditLogs).values(eligible.map(row => ({
        adminUserId: session.adminId,
        action: 'translation.publish',
        entityType: 'content_translation',
        entityId: row.id,
        metadata: { bulk: true, targetLang: row.targetLanguageCode, previousStatus: 'APPROVED_OR_SCHEDULED' },
      })));
    });
    // Cache invalidation is deliberately after commit: a failed transaction
    // must not make an unpublished translation appear fresh.
    for (const slug of new Set(eligible.map(row => row.slug).filter((value): value is string => Boolean(value)))) {
      revalidatePublicServiceDetail(slug);
    }
  }
  return NextResponse.json({ published: eligibleIds, skipped: ids.filter(id => !eligibleIds.includes(id)) });
}