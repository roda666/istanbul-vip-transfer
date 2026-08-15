/**
 * PATCH /admin/api/studio/projects/[id]/translations/[lang]
 * Approve / reject / update a single translation.
 * Body: { action: 'approve' | 'reject' | 'update'; content?: StudioContent; notes?: string }
 *
 * Rules:
 *  - 'approve' sets status to 'approved'; only then can it be published.
 *  - 'update' resets status to 'draft' (approval clears on edit).
 *  - 'reject' resets status to 'draft'.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; lang: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id, lang } = await params;
  const body = await req.json() as { action?: string; content?: unknown; notes?: string };
  if (!body.action) return NextResponse.json({ error: 'action gerekli.' }, { status: 400 });

  const { db } = await import('@/db');
  const { studioProjectTranslations, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const [existing] = await db.select().from(studioProjectTranslations)
    .where(and(eq(studioProjectTranslations.projectId, id), eq(studioProjectTranslations.lang, lang)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Çeviri bulunamadı.' }, { status: 404 });

  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);

  const now = new Date();

  if (body.action === 'approve') {
    const [updated] = await db.update(studioProjectTranslations).set({
      status:     'approved',
      approvedAt: now,
      approvedBy: admin?.id ?? null,
      updatedAt:  now,
    }).where(eq(studioProjectTranslations.id, existing.id)).returning();

    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'translation_approved', detail: { lang, notes: body.notes ?? null }, createdAt: now,
    });
    return NextResponse.json({ translation: updated });
  }

  if (body.action === 'reject') {
    const [updated] = await db.update(studioProjectTranslations).set({
      status:     'draft',
      approvedAt: null,
      approvedBy: null,
      updatedAt:  now,
    }).where(eq(studioProjectTranslations.id, existing.id)).returning();

    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'translation_rejected', detail: { lang, notes: body.notes ?? null }, createdAt: now,
    });
    return NextResponse.json({ translation: updated });
  }

  if (body.action === 'update') {
    const [updated] = await db.update(studioProjectTranslations).set({
      content:    body.content as never,
      status:     'draft',  // reset on edit
      approvedAt: null,
      approvedBy: null,
      updatedAt:  now,
    }).where(eq(studioProjectTranslations.id, existing.id)).returning();

    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'translation_updated', detail: { lang }, createdAt: now,
    });
    return NextResponse.json({ translation: updated });
  }

  return NextResponse.json({ error: 'Geçersiz action.' }, { status: 400 });
}
