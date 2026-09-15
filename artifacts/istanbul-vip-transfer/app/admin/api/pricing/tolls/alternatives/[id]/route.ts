import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, routeTollAlternativeItems, routeTollAlternatives, tollPoints, tollTariffs, transferRoutes } from '@/db/schema';
import { tollAlternativeInputSchema } from '@/lib/toll-input';

export const dynamic = 'force-dynamic';

/** PATCH /admin/api/pricing/tolls/alternatives/[id] — update a combination, order, or default choice. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const payload = tollAlternativeInputSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? 'Geçersiz rota alternatifi.' }, { status: 422 });
  }
  try {
    const [[existing], [route]] = await Promise.all([
      db.select().from(routeTollAlternatives).where(eq(routeTollAlternatives.id, id)).limit(1),
      db.select({ id: transferRoutes.id }).from(transferRoutes).where(eq(transferRoutes.id, payload.data.routeId)).limit(1),
    ]);
    if (!existing) return NextResponse.json({ error: 'Rota alternatifi bulunamadı.' }, { status: 404 });
    if (!route) return NextResponse.json({ error: 'Güzergâh bulunamadı.' }, { status: 404 });
    if (existing.routeId !== payload.data.routeId) {
      return NextResponse.json({ error: 'Alternatif başka bir güzergâha taşınamaz. Hedef rota için yeni alternatif oluşturun.' }, { status: 422 });
    }
    if (payload.data.pointIds.length) {
      const points = await db.select({ id: tollPoints.id, pricingMode: tollPoints.pricingMode }).from(tollPoints).where(and(
        inArray(tollPoints.id, payload.data.pointIds),
        eq(tollPoints.active, true),
      ));
      if (points.length !== payload.data.pointIds.length) {
        return NextResponse.json({ error: 'Alternatife yalnız aktif geçiş noktaları eklenebilir.' }, { status: 422 });
      }
      const gatePointIds = points.filter((point) => point.pricingMode === 'GATE_PAIR').map((point) => point.id);
      if (Object.keys(payload.data.gatePairs).some((tollPointId) => !gatePointIds.includes(tollPointId))) {
        return NextResponse.json({ error: 'Gişe çifti yalnızca gişe bazlı ücretlendirilen geçiş noktaları için tanımlanabilir.' }, { status: 422 });
      }
      for (const tollPointId of gatePointIds) {
        const pair = payload.data.gatePairs[tollPointId];
        if (!pair) return NextResponse.json({ error: 'Önce Geçiş Noktaları ve Maliyetler bölümünde bu nokta için gişe çifti tarifesi ekleyin' }, { status: 422 });
        const [tariff] = await db.select({ id: tollTariffs.id }).from(tollTariffs).where(and(
          eq(tollTariffs.tollPointId, tollPointId),
          eq(tollTariffs.entryGateName, pair.entryGateName),
          eq(tollTariffs.exitGateName, pair.exitGateName),
          eq(tollTariffs.active, true),
        )).limit(1);
        if (!tariff) return NextResponse.json({ error: 'Önce Geçiş Noktaları ve Maliyetler bölümünde bu nokta için gişe çifti tarifesi ekleyin' }, { status: 422 });
      }
    }
    const now = new Date();
    const alternative = await db.transaction(async (tx) => {
      const activeDefaults = await tx.select({ id: routeTollAlternatives.id }).from(routeTollAlternatives).where(and(
        eq(routeTollAlternatives.routeId, payload.data.routeId),
        eq(routeTollAlternatives.active, true),
        eq(routeTollAlternatives.isDefault, true),
      ));
      if (existing.isDefault && (!payload.data.active || !payload.data.isDefault) && activeDefaults.length <= 1) {
        throw new Error('Bu rotanın tek varsayılan alternatifi pasifleştirilemez veya kaldırılmaz. Önce başka bir alternatifi varsayılan yapın.');
      }
      const isDefault = payload.data.isDefault || (payload.data.active && activeDefaults.length === 0);
      if (isDefault) {
        await tx.update(routeTollAlternatives).set({ isDefault: false, updatedAt: now }).where(and(
          eq(routeTollAlternatives.routeId, payload.data.routeId),
          eq(routeTollAlternatives.isDefault, true),
        ));
      }
      await tx.delete(routeTollAlternativeItems).where(eq(routeTollAlternativeItems.alternativeId, id));
      if (payload.data.pointIds.length) {
        await tx.insert(routeTollAlternativeItems).values(payload.data.pointIds.map((tollPointId, displayOrder) => ({
          alternativeId: id,
          tollPointId,
          displayOrder,
          entryGateName: payload.data.gatePairs?.[tollPointId]?.entryGateName ?? null,
          exitGateName: payload.data.gatePairs?.[tollPointId]?.exitGateName ?? null,
        })));
      }
      const [updated] = await tx.update(routeTollAlternatives).set({
        routeId: payload.data.routeId,
        name: payload.data.name,
        active: payload.data.active,
        isDefault,
        displayOrder: payload.data.displayOrder,
        needsReview: payload.data.needsReview,
        reviewNote: payload.data.reviewNote,
        updatedAt: now,
      }).where(eq(routeTollAlternatives.id, id)).returning();
      return updated;
    });
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: alternative.active ? 'UPDATE' : 'DEACTIVATE',
      entityType: 'RouteTollAlternative',
      entityId: alternative.id,
      metadata: { routeId: alternative.routeId, isDefault: alternative.isDefault, points: payload.data.pointIds.length },
    }).catch(() => {});
    return NextResponse.json({ alternative: { ...alternative, pointIds: payload.data.pointIds, gatePairs: payload.data.gatePairs ?? {} } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Rota alternatifi güncellenemedi.' }, { status: 422 });
  }
}

/** DELETE /admin/api/pricing/tolls/alternatives/[id] — remove only this alternative and its items. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const deleted = await db.transaction(async (tx) => {
      const [existing] = await tx.select({
        id: routeTollAlternatives.id,
        routeId: routeTollAlternatives.routeId,
        active: routeTollAlternatives.active,
        isDefault: routeTollAlternatives.isDefault,
      }).from(routeTollAlternatives).where(eq(routeTollAlternatives.id, id)).limit(1);
      if (!existing) return null;

      if (existing.active && existing.isDefault) {
        const [replacement] = await tx.select({ id: routeTollAlternatives.id })
          .from(routeTollAlternatives)
          .where(and(
            eq(routeTollAlternatives.routeId, existing.routeId),
            eq(routeTollAlternatives.active, true),
            ne(routeTollAlternatives.id, existing.id),
          ))
          .orderBy(routeTollAlternatives.displayOrder, routeTollAlternatives.id)
          .limit(1);
        if (replacement) {
          await tx.update(routeTollAlternatives)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(eq(routeTollAlternatives.id, existing.id));
          await tx.update(routeTollAlternatives)
            .set({ isDefault: true, updatedAt: new Date() })
            .where(eq(routeTollAlternatives.id, replacement.id));
        }
      }

      // Delete children explicitly before the parent so this remains clear
      // and transactional even if the FK cascade is changed in the future.
      await tx.delete(routeTollAlternativeItems).where(eq(routeTollAlternativeItems.alternativeId, id));
      const [removed] = await tx.delete(routeTollAlternatives)
        .where(eq(routeTollAlternatives.id, id))
        .returning({ id: routeTollAlternatives.id, routeId: routeTollAlternatives.routeId });
      return removed ?? null;
    });
    if (!deleted) return NextResponse.json({ error: 'Rota alternatifi bulunamadı.' }, { status: 404 });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'DELETE',
      entityType: 'RouteTollAlternative',
      entityId: deleted.id,
      metadata: { routeId: deleted.routeId, action: 'deleted' },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Rota alternatifi silinemedi.' }, { status: 422 });
  }
}