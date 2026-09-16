import { NextRequest, NextResponse } from 'next/server';
import { count, eq, sql } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import {
  auditLogs,
  intercityTollCorridorAlternativeItems,
  routeTollAlternativeItems,
  tollPoints,
  tollTariffImports,
  tollTariffs,
  vehicleTollPointClasses,
} from '@/db/schema';
import { legacyFerryFlatPointPatchInputSchema, tollPointInputSchema } from '@/lib/toll-input';

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
  const [existing] = await db.select({
    type: tollPoints.type,
    pricingMode: tollPoints.pricingMode,
  }).from(tollPoints).where(eq(tollPoints.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: 'Geçiş noktası bulunamadı.' }, { status: 404 });
  // Legacy FERRY+FLAT rows remain editable without silently converting them.
  // The compatibility schema is only selected for an already-stored legacy
  // row; POST and every other point update stay strict.
  const schema = existing.type === 'FERRY' && existing.pricingMode === 'FLAT'
    ? legacyFerryFlatPointPatchInputSchema
    : tollPointInputSchema;
  const payload = schema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? 'Geçersiz geçiş noktası.' }, { status: 422 });
  }
  const pointData = payload.data.type === 'FERRY'
    ? { ...payload.data, dayStartHour: null, nightStartHour: null }
    : payload.data;
  const [point] = await db.update(tollPoints).set({
    ...pointData,
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

/** DELETE /admin/api/pricing/tolls/[id] — delete only a completely unreferenced crossing point. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.capabilities.fleet_pricing.canManage) {
    return NextResponse.json({ error: 'Bu işlem için geçiş ücretleri yönetim yetkisi gerekir.' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute<{ id: string; name: string }>(
        sql`select id, name from toll_points where id = ${id} for update`,
      );
      const point = locked[0];
      if (!point) return { status: 'missing' as const };

      const [
        [tariffCount],
        [routeItemCount],
        [intercityItemCount],
        [importCount],
        [vehicleClassCount],
      ] = await Promise.all([
        tx.select({ value: count() }).from(tollTariffs).where(eq(tollTariffs.tollPointId, id)),
        tx.select({ value: count() }).from(routeTollAlternativeItems).where(eq(routeTollAlternativeItems.tollPointId, id)),
        tx.select({ value: count() }).from(intercityTollCorridorAlternativeItems).where(eq(intercityTollCorridorAlternativeItems.tollPointId, id)),
        tx.select({ value: count() }).from(tollTariffImports).where(eq(tollTariffImports.tollPointId, id)),
        tx.select({ value: count() }).from(vehicleTollPointClasses).where(eq(vehicleTollPointClasses.tollPointId, id)),
      ]);
      const dependencies = {
        tariffs: tariffCount.value,
        routeCombinations: routeItemCount.value + intercityItemCount.value,
        tariffImports: importCount.value,
        vehicleClassAssignments: vehicleClassCount.value,
      };
      if (Object.values(dependencies).some((value) => value > 0)) {
        return { status: 'blocked' as const, name: point.name, dependencies };
      }

      const [deleted] = await tx.delete(tollPoints).where(eq(tollPoints.id, id)).returning({
        id: tollPoints.id,
        name: tollPoints.name,
      });
      if (!deleted) return { status: 'missing' as const };
      return { status: 'deleted' as const, point: deleted };
    });

    if (result.status === 'missing') {
      return NextResponse.json({ error: 'Geçiş noktası bulunamadı.' }, { status: 404 });
    }
    if (result.status === 'blocked') {
      const parts = [
        result.dependencies.tariffs > 0 ? `${result.dependencies.tariffs} tarife` : '',
        result.dependencies.routeCombinations > 0 ? `${result.dependencies.routeCombinations} rota kombinasyonu bağlantısı` : '',
        result.dependencies.tariffImports > 0 ? `${result.dependencies.tariffImports} tarife içe aktarma kaydı` : '',
        result.dependencies.vehicleClassAssignments > 0 ? `${result.dependencies.vehicleClassAssignments} araç sınıfı ataması` : '',
      ].filter(Boolean);
      return NextResponse.json({
        error: `“${result.name}” silinemedi. Önce bağlı ${parts.join(', ')} kaldırılmalıdır. Hiçbir bağlı kayıt silinmedi.`,
        dependencies: result.dependencies,
      }, { status: 409 });
    }

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'DELETE',
      entityType: 'TollPoint',
      entityId: result.point.id,
      metadata: { name: result.point.name },
    }).catch(() => {});
    return NextResponse.json({ deleted: true, point: result.point });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Geçiş noktası silinemedi.',
    }, { status: 422 });
  }
}