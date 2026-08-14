/**
 * GET /admin/api/service-pages/[id]/audit
 * Returns the last 20 audit log entries for a service page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { db }        = await import('@/db');
    const { auditLogs, adminUsers } = await import('@/db/schema');
    const { eq, desc }  = await import('drizzle-orm');

    const rows = await db
      .select({
        id:          auditLogs.id,
        action:      auditLogs.action,
        createdAt:   auditLogs.createdAt,
        metadata:    auditLogs.metadata,
        adminName:   adminUsers.name,
      })
      .from(auditLogs)
      .leftJoin(adminUsers, eq(auditLogs.adminUserId, adminUsers.id))
      .where(eq(auditLogs.entityId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(20);

    const entries = rows.map(r => ({
      id:        r.id,
      action:    r.action,
      createdAt: r.createdAt.toISOString(),
      adminName: r.adminName ?? 'Sistem',
      locale:    (r.metadata as Record<string, unknown> | null)?.locale ?? null,
    }));

    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}
