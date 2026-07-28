/**
 * GET  /admin/api/translations  — list translation jobs (filterable)
 * POST /admin/api/translations  — create a translation job manually
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';

const createSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
  targetLanguageCode: z.string().min(2).max(10),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const entityType = searchParams.get('entityType') ?? undefined;
  const targetLang = searchParams.get('targetLang') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const { db } = await import('@/db');
  const { contentTranslations } = await import('@/db/schema');
  const { eq, and, desc, count } = await import('drizzle-orm');

  try {
    const conditions = [];
    if (entityType) conditions.push(eq(contentTranslations.entityType, entityType));
    if (targetLang) conditions.push(eq(contentTranslations.targetLanguageCode, targetLang));
    if (status) conditions.push(eq(contentTranslations.status, status as never));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalRows] = await Promise.all([
      db.select({
        id: contentTranslations.id,
        entityType: contentTranslations.entityType,
        entityId: contentTranslations.entityId,
        targetLanguageCode: contentTranslations.targetLanguageCode,
        status: contentTranslations.status,
        title: contentTranslations.title,
        isAiGenerated: contentTranslations.isAiGenerated,
        updatedAt: contentTranslations.updatedAt,
        approvedAt: contentTranslations.approvedAt,
        publishedAt: contentTranslations.publishedAt,
        failureReason: contentTranslations.failureReason,
      })
        .from(contentTranslations)
        .where(where)
        .orderBy(desc(contentTranslations.updatedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(contentTranslations).where(where),
    ]);

    return NextResponse.json({
      items: rows,
      total: totalRows[0]?.count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { contentTranslations, auditLogs } = await import('@/db/schema');

  try {
    const [job] = await db
      .insert(contentTranslations)
      .values({
        ...parsed.data,
        status: 'NOT_STARTED',
        isAiGenerated: false,
        createdBy: session.adminId,
        updatedBy: session.adminId,
      })
      .onConflictDoNothing()
      .returning();

    if (!job) {
      return NextResponse.json({ error: 'Translation job already exists for this entity and language' }, { status: 409 });
    }

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'translation.create',
      entityType: 'content_translation',
      entityId: job.id,
      metadata: { entityType: job.entityType, entityId: job.entityId, targetLang: job.targetLanguageCode },
    });

    return NextResponse.json({ item: job }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
