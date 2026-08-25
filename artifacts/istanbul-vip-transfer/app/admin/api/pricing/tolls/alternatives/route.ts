import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, routeTollAlternativeItems, routeTollAlternatives, tollPoints, transferRoutes } from '@/db/schema';
import { tollAlternativeInputSchema } from '@/lib/toll-input';

export const dynamic = 'force-dynamic';

/** POST /admin/api/pricing/tolls/alternatives — create a route-level toll combination. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = tollAlternativeInputSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? 'Geçersiz rota alternatifi.' }, { status: 422 });
  }
  try {
    const [route] = await db.select({ id: transferRoutes.id }).from(transferRoutes)
      .where(eq(transferRoutes.id, payload.data.routeId)).limit(1);
    if (!route) return NextResponse.json({ error: 'Güzergâh bulunamadı.' }, { status: 404 });
    if (payload.data.pointIds.length) {
      const points = await db.select({ id: tollPoints.id }).from(tollPoints).where(and(
        inArray(tollPoints.id, payload.data.pointIds),
        eq(tollPoints.active, true),
      ));
      if (points.length !== payload.data.pointIds.length) {
        return NextResponse.json({ error: 'Alternatife yalnız aktif geçiş noktaları eklenebilir.' }, { status: 422 });
      }
    }
    const now = new Date();
    const alternative = await db.transaction(async (tx) => {
      const activeDefaults = await tx.select({ id: routeTollAlternatives.id }).from(routeTollAlternatives).where(and(
        eq(routeTollAlternatives.routeId, payload.data.routeId),
        eq(routeTollAlternatives.active, true),
        eq(routeTollAlternatives.isDefault, true),
      ));
      // The first active option becomes the default automatically. This keeps
      // a route safely quotable without relying on the browser to choose one.
      const isDefault = payload.data.isDefault || (payload.data.active && activeDefaults.length === 0);
      if (payload.data.isDefault) {
        await tx.update(routeTollAlternatives).set({ isDefault: false, updatedAt: now }).where(and(
          eq(routeTollAlternatives.routeId, payload.data.routeId),
          eq(routeTollAlternatives.isDefault, true),
        ));
      }
      const [created] = await tx.insert(routeTollAlternatives).values({
        routeId: payload.data.routeId,
        name: payload.data.name,
        active: payload.data.active,
        isDefault,
        displayOrder: payload.data.displayOrder,
        createdAt: now,
        updatedAt: now,
      }).returning();
      if (payload.data.pointIds.length) {
        await tx.insert(routeTollAlternativeItems).values(payload.data.pointIds.map((tollPointId, displayOrder) => ({
          alternativeId: created.id,
          tollPointId,
          displayOrder,
        })));
      }
      return created;
    });
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'CREATE',
      entityType: 'RouteTollAlternative',
      entityId: alternative.id,
      metadata: { routeId: alternative.routeId, isDefault: alternative.isDefault, points: payload.data.pointIds.length },
    }).catch(() => {});
    return NextResponse.json({ alternative: { ...alternative, pointIds: payload.data.pointIds } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Rota alternatifi kaydedilemedi.' }, { status: 422 });
  }
}