/**
 * POST /admin/api/studio/projects/[id]/approve
 * Approve or reject the Turkish draft.
 * Translations cannot start until TR draft is approved.
 * Repeated approve/reject is idempotent — no duplicate audit rows for same state.
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

  let body: { action?: string; notes?: string } = {};
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: 'Geçersiz JSON gövdesi.' }, { status: 400 }); }

  if (!body.action || !['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: '"action" alanı "approve" veya "reject" olmalıdır.' }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { studioProjects, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  try {
    const [project] = await db.select({
      id: studioProjects.id,
      trContent: studioProjects.trContent,
      trApprovedAt: studioProjects.trApprovedAt,
    }).from(studioProjects).where(eq(studioProjects.id, id)).limit(1);

    if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
    if (!project.trContent) return NextResponse.json({ error: 'Onaylanacak Türkçe taslak yok.' }, { status: 400 });

    const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
      .where(eq(adminUsers.id, session.adminId as never)).limit(1);

    const now = new Date();

    if (body.action === 'approve') {
      // Idempotent: if already approved, just return ok without extra audit entry
      if (project.trApprovedAt) {
        return NextResponse.json({ ok: true, status: 'approved', alreadyApproved: true });
      }

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
        detail: { notes: body.notes ?? null } as Record<string, unknown>,
        createdAt: now,
      });

      return NextResponse.json({ ok: true, status: 'approved' });
    }

    // reject
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
      detail: { notes: body.notes ?? null } as Record<string, unknown>,
      createdAt: now,
    });

    return NextResponse.json({ ok: true, status: 'rejected' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : 'Beklenmeyen hata.';
    console.error('[studio/approve]', msg);
    return NextResponse.json({ error: `Onay işlemi başarısız: ${msg}` }, { status: 500 });
  }
}
