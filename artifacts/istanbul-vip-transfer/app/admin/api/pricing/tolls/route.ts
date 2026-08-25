import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, tollPoints } from '@/db/schema';
import { getTollManagementData } from '@/lib/toll-management';
import { tollPointInputSchema } from '@/lib/toll-input';

export const dynamic = 'force-dynamic';

/** GET /admin/api/pricing/tolls — central, admin-only toll management data. */
export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await getTollManagementData());
}

/** POST /admin/api/pricing/tolls — create a centrally managed crossing point. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = tollPointInputSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? 'Geçersiz geçiş noktası.' }, { status: 422 });
  }
  const now = new Date();
  const [point] = await db.insert(tollPoints).values({
    ...payload.data,
    createdAt: now,
    updatedAt: now,
    createdBy: session.adminId,
    updatedBy: session.adminId,
  }).returning();
  await db.insert(auditLogs).values({
    adminUserId: session.adminId,
    action: 'CREATE',
    entityType: 'TollPoint',
    entityId: point.id,
    metadata: { type: point.type, active: point.active },
  }).catch(() => {});
  return NextResponse.json({ point }, { status: 201 });
}