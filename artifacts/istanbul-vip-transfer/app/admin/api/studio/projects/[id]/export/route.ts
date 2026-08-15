/**
 * POST /admin/api/studio/projects/[id]/export
 * Export TR content to Blog or Service CMS as DRAFT.
 * Prevents slug conflicts. Requires TR approval.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { db } = await import('@/db');
  const { studioProjects, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });

  if (!project.trApprovedAt) {
    return NextResponse.json({ error: 'CMS\'e aktarmak için Türkçe taslağı onaylamanız gerekiyor.' }, { status: 400 });
  }
  if (!project.trContent) {
    return NextResponse.json({ error: 'Aktarılacak Türkçe içerik yok.' }, { status: 400 });
  }

  const { exportStudioToCms } = await import('@/lib/studio/export-to-cms');
  const result = await exportStudioToCms({
    contentType:  project.contentType as 'blog' | 'service',
    trContent:    project.trContent as unknown as import('@/lib/studio/types').StudioContent,
    config:       project.config as unknown as import('@/lib/studio/types').StudioConfig,
    coverImageUrl: project.coverImageUrl,
    coverImageAlt: project.coverImageAlt,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const now = new Date();
  await db.update(studioProjects).set({
    cmsEntityId:   result.cmsEntityId,
    cmsEntityType: result.cmsEntityType,
    stage:         'review',
    updatedAt:     now,
  }).where(eq(studioProjects.id, id));

  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);
  await db.insert(studioAudit).values({
    projectId: id, adminId: admin?.id ?? null,
    action: 'exported_to_cms',
    detail: { cmsEntityId: result.cmsEntityId, cmsEntityType: result.cmsEntityType, slug: result.slug },
    createdAt: now,
  });

  return NextResponse.json({ cmsEntityId: result.cmsEntityId, cmsEntityType: result.cmsEntityType, slug: result.slug });
}
