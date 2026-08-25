import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, tollPoints } from '@/db/schema';
import { tollPointInputSchema } from '@/lib/toll-input';

export const dynamic = 'force-dynamic';

/** PATCH /admin/api/pricing/tolls/[id] — edit or soft-deactivate a crossing point. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const payload = tollPointInputSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? 'Geçersiz geçiş noktası.' }, { status: 422 });
  }
  const [point] = await db.update(tollPoints).set({
    ...payload.data,
    updatedAt: new Date(),
    updatedBy: session.adminId,
  }).where(eq(tollPoints.id, id)).returning();
  if (!point) return NextResponse.json({ error: 'Geçiş noktası bulunamadı.' }, { status: 404 });
  await db.insert(auditLogs).values({
    adminUserId: session.adminId,
    action: point.active ? 'UPDATE' : 'DEACTIVATE',
    entityType: 'TollPoint',
    entityId: point.id,
    metadata: { type: point.type, active: point.active },
  }).catch(() => {});
  return NextResponse.json({ point });
}