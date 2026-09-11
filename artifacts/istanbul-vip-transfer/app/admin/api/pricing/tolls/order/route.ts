import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, ne, lt, gt } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, tollPoints } from '@/db/schema';

export const dynamic = 'force-dynamic';

/** Atomically swaps adjacent display-order metadata; it never changes pricing or active state. */
export async function POST(request: NextRequest) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { id?: unknown; direction?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  const direction = body?.direction === 'up' || body?.direction === 'down' ? body.direction : null;
  if (!id || !direction) return NextResponse.json({ error: 'Geçersiz sıralama isteği.' }, { status: 422 });
  try {
    const result = await db.transaction(async (tx) => {
      const [point] = await tx.select({ id: tollPoints.id, displayOrder: tollPoints.displayOrder })
        .from(tollPoints).where(eq(tollPoints.id, id)).limit(1);
      if (!point) return null;
      const [adjacent] = await tx.select({ id: tollPoints.id, displayOrder: tollPoints.displayOrder })
        .from(tollPoints)
        .where(direction === 'up'
          ? and(ne(tollPoints.id, id), lt(tollPoints.displayOrder, point.displayOrder))
          : and(ne(tollPoints.id, id), gt(tollPoints.displayOrder, point.displayOrder)))
        .orderBy(direction === 'up' ? desc(tollPoints.displayOrder) : asc(tollPoints.displayOrder), asc(tollPoints.id)).limit(1);
      if (!adjacent) return { boundary: true, points: await tx.select().from(tollPoints).orderBy(asc(tollPoints.displayOrder), asc(tollPoints.name), asc(tollPoints.id)) };
      await tx.update(tollPoints).set({ displayOrder: adjacent.displayOrder, updatedAt: new Date(), updatedBy: session.adminId }).where(eq(tollPoints.id, point.id));
      await tx.update(tollPoints).set({ displayOrder: point.displayOrder, updatedAt: new Date(), updatedBy: session.adminId }).where(eq(tollPoints.id, adjacent.id));
      const points = await tx.select().from(tollPoints).orderBy(asc(tollPoints.displayOrder), asc(tollPoints.name), asc(tollPoints.id));
      return { boundary: false, points };
    });
    if (!result) return NextResponse.json({ error: 'Geçiş noktası bulunamadı.' }, { status: 404 });
    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'REORDER', entityType: 'TollPoint', entityId: id, metadata: { direction } }).catch(() => {});
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sıralama güncellenemedi.' }, { status: 422 });
  }
}