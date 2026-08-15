/**
 * GET    /admin/api/studio/projects/[id]  — get full project with relations
 * PATCH  /admin/api/studio/projects/[id]  — update config / stage / status
 * DELETE /admin/api/studio/projects/[id]  — delete project
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { db } = await import('@/db');
  const {
    studioProjects, studioProjectTranslations,
    studioImages, studioResearch, studioDistribution,
    studioSchedules, studioAudit,
  } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });

  const [translations, images, research, distribution, recentAudit, schedule] = await Promise.all([
    db.select().from(studioProjectTranslations).where(eq(studioProjectTranslations.projectId, id)),
    db.select().from(studioImages).where(eq(studioImages.projectId, id)).orderBy(desc(studioImages.createdAt)),
    db.select().from(studioResearch).where(eq(studioResearch.projectId, id)),
    db.select().from(studioDistribution).where(eq(studioDistribution.projectId, id)),
    db.select().from(studioAudit).where(eq(studioAudit.projectId, id)).orderBy(desc(studioAudit.createdAt)).limit(20),
    db.select().from(studioSchedules).where(eq(studioSchedules.projectId, id)).orderBy(desc(studioSchedules.createdAt)).limit(1),
  ]);

  return NextResponse.json({
    project: {
      ...project,
      translations,
      images,
      research,
      distribution,
      recentAudit,
      schedule: schedule[0] ?? null,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const body = raw as Record<string, unknown>;
  const { db } = await import('@/db');
  const { studioProjects, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const allowed = ['titleWorking', 'config', 'stage', 'status', 'trContent', 'coverImageUrl', 'coverImageAlt'];
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) {
    if (k in body) updates[k] = body[k];
  }

  // If content is edited, reset TR approval
  if ('trContent' in body) {
    updates.trApprovedAt = null;
    updates.trApprovedBy = null;
    // status back to draft if was approved
    if (!body.status) updates.status = 'draft';
  }

  const [updated] = await db.update(studioProjects).set(updates as never).where(eq(studioProjects.id, id)).returning();
  if (!updated) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });

  // Audit
  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);
  await db.insert(studioAudit).values({
    projectId: id, adminId: admin?.id ?? null,
    action: 'project_updated', detail: { updatedFields: Object.keys(updates) }, createdAt: new Date(),
  });

  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { db } = await import('@/db');
  const { studioProjects } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  await db.delete(studioProjects).where(eq(studioProjects.id, id));
  return NextResponse.json({ ok: true });
}
