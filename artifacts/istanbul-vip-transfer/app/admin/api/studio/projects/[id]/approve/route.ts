/**
 * POST /admin/api/studio/projects/[id]/approve
 * Approve (or reject) the Turkish draft.
 * Translations cannot start until TR draft is approved.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const body = await req.json() as { action: 'approve' | 'reject'; notes?: string };
  if (!body.action) return NextResponse.json({ error: 'action gerekli.' }, { status: 400 });

  const { db } = await import('@/db');
  const { studioProjects, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
  if (!project.trContent) return NextResponse.json({ error: 'Onaylanacak Türkçe taslak yok.' }, { status: 400 });

  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);

  const now = new Date();

  if (body.action === 'approve') {
    await db.update(studioProjects).set({
      trApprovedAt: now,
      trApprovedBy: admin?.id ?? null,
      status:       'approved',
      stage:        'translations',
      updatedAt:    now,
    }).where(eq(studioProjects.id, id));

    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'tr_draft_approved',
      detail: { notes: body.notes ?? null },
      createdAt: now,
    });

    return NextResponse.json({ ok: true, status: 'approved' });
  }

  if (body.action === 'reject') {
    await db.update(studioProjects).set({
      trApprovedAt: null,
      trApprovedBy: null,
      status:       'draft',
      stage:        'draft',
      updatedAt:    now,
    }).where(eq(studioProjects.id, id));

    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'tr_draft_rejected',
      detail: { notes: body.notes ?? null },
      createdAt: now,
    });

    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  return NextResponse.json({ error: 'Geçersiz action.' }, { status: 400 });
}
