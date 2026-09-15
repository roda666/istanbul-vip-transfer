import { NextRequest, NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, tollPoints } from '@/db/schema';

export const dynamic = 'force-dynamic';

/** Atomically moves one point by one deterministic step and normalizes duplicate order values. */
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
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('toll-points-display-order'))`);
      const rows = await tx.select({ id: tollPoints.id })
        .from(tollPoints)
        .orderBy(asc(tollPoints.displayOrder), asc(tollPoints.name), asc(tollPoints.id))
        .for('update');
      const currentIndex = rows.findIndex((row) => row.id === id);
      if (currentIndex < 0) return null;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= rows.length) return { boundary: true };

      [rows[currentIndex], rows[targetIndex]] = [rows[targetIndex], rows[currentIndex]];
      const now = new Date();
      // Two phases avoid transient uniqueness conflicts and also repair any
      // historical duplicate display_order values under the same lock.
      for (let index = 0; index < rows.length; index += 1) {
        await tx.update(tollPoints).set({ displayOrder: -1_000_000 - index })
          .where(eq(tollPoints.id, rows[index].id));
      }
      for (let index = 0; index < rows.length; index += 1) {
        await tx.update(tollPoints).set({
          displayOrder: index,
          updatedAt: now,
          updatedBy: session.adminId,
        }).where(eq(tollPoints.id, rows[index].id));
      }
      return { boundary: false };
    });
    if (!result) return NextResponse.json({ error: 'Geçiş noktası bulunamadı.' }, { status: 404 });
    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'REORDER', entityType: 'TollPoint', entityId: id, metadata: { direction } }).catch(() => {});
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sıralama güncellenemedi.' }, { status: 422 });
  }
}