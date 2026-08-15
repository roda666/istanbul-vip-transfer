/**
 * GET /admin/api/studio/projects/[id]/audit
 * Paginated audit log for a project.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const url    = new URL(req.url);
  const limit  = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100);

  const { db } = await import('@/db');
  const { studioAudit, adminUsers } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const rows = await db
    .select({
      id:        studioAudit.id,
      action:    studioAudit.action,
      detail:    studioAudit.detail,
      createdAt: studioAudit.createdAt,
      adminName: adminUsers.name,
    })
    .from(studioAudit)
    .leftJoin(adminUsers, eq(studioAudit.adminId, adminUsers.id))
    .where(eq(studioAudit.projectId, id))
    .orderBy(desc(studioAudit.createdAt))
    .limit(limit);

  return NextResponse.json({ audit: rows });
}
