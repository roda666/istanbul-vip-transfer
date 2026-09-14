import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, sql } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, tollTariffs } from '@/db/schema';

export const dynamic = 'force-dynamic';

/**
 * Swap one tariff with its adjacent tariff in the same point/class group.
 * The advisory lock makes the read/normalise/swap sequence atomic even when
 * two administrators click at the same time.
 */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    id?: unknown;
    direction?: unknown;
    tollPointId?: unknown;
    vehicleClass?: unknown;
  } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  const direction = body?.direction === 'up' || body?.direction === 'down' ? body.direction : null;
  if (!id || !direction) {
    return NextResponse.json({ error: 'Geçersiz tarife sıralama isteği.' }, { status: 422 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select({
        id: tollTariffs.id,
        tollPointId: tollTariffs.tollPointId,
        vehicleClass: tollTariffs.vehicleClass,
        displayOrder: tollTariffs.displayOrder,
      }).from(tollTariffs).where(eq(tollTariffs.id, id)).limit(1);
      if (!current) return null;
      if (body?.tollPointId !== undefined && body.tollPointId !== current.tollPointId) {
        throw new Error('Tarifeler yalnızca aynı geçiş noktası içinde sıralanabilir.');
      }
      if (body?.vehicleClass !== undefined && body.vehicleClass !== current.vehicleClass) {
        throw new Error('Tarifeler yalnızca aynı araç sınıfı içinde sıralanabilir.');
      }

      await tx.execute(sql`select pg_advisory_xact_lock(
        hashtextextended(${`${current.tollPointId}:${current.vehicleClass}`}, 0::bigint)
      )`);

      let rows = await tx.select({
        id: tollTariffs.id,
        displayOrder: tollTariffs.displayOrder,
      }).from(tollTariffs).where(and(
        eq(tollTariffs.tollPointId, current.tollPointId),
        eq(tollTariffs.vehicleClass, current.vehicleClass),
      )).orderBy(asc(tollTariffs.displayOrder), asc(tollTariffs.id));

      // Legacy/directly-created rows may share the safe default (0). Establish
      // a deterministic contiguous order before swapping, without changing
      // tariff values, class, point, or active state.
      if (rows.some((row, index) => row.displayOrder !== index)) {
        for (const [index, row] of rows.entries()) {
          await tx.update(tollTariffs)
            .set({ displayOrder: index, updatedAt: new Date(), updatedBy: session.adminId })
            .where(eq(tollTariffs.id, row.id));
        }
        rows = rows.map((row, index) => ({ ...row, displayOrder: index }));
      }

      const index = rows.findIndex((row) => row.id === id);
      const adjacentIndex = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || adjacentIndex < 0 || adjacentIndex >= rows.length) {
        const refreshed = await tx.select().from(tollTariffs)
          .where(and(eq(tollTariffs.tollPointId, current.tollPointId), eq(tollTariffs.vehicleClass, current.vehicleClass)))
          .orderBy(asc(tollTariffs.displayOrder), asc(tollTariffs.id));
        return { boundary: true, tariffs: refreshed };
      }
      const adjacent = rows[adjacentIndex];
      const now = new Date();
      await tx.update(tollTariffs).set({ displayOrder: adjacent.displayOrder, updatedAt: now, updatedBy: session.adminId }).where(eq(tollTariffs.id, id));
      await tx.update(tollTariffs).set({ displayOrder: rows[index].displayOrder, updatedAt: now, updatedBy: session.adminId }).where(eq(tollTariffs.id, adjacent.id));
      const refreshed = await tx.select().from(tollTariffs)
        .where(and(eq(tollTariffs.tollPointId, current.tollPointId), eq(tollTariffs.vehicleClass, current.vehicleClass)))
        .orderBy(asc(tollTariffs.displayOrder), asc(tollTariffs.id));
      return { boundary: false, tariffs: refreshed };
    });

    if (!result) return NextResponse.json({ error: 'Geçiş tarifesi bulunamadı.' }, { status: 404 });
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'REORDER',
      entityType: 'TollTariff',
      entityId: id,
      metadata: { direction },
    }).catch(() => {});
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Tarife sıralaması güncellenemedi.' }, { status: 422 });
  }
}