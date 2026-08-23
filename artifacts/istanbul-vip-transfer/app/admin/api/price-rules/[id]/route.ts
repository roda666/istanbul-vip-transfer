import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, routePriceRules } from '@/db/schema';
import { priceRuleInputSchema } from '@/lib/price-rule-input';

export const dynamic = 'force-dynamic';

/** PUT /admin/api/price-rules/[id] — update an auditable estimate rule. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }
  const parsed = priceRuleInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }
  const { routePriceRules: rules, transferRoutes, vehicles } = await import('@/db/schema');
  const [route, vehicle] = await Promise.all([
    db.select({ id: transferRoutes.id }).from(transferRoutes).where(eq(transferRoutes.id, parsed.data.routeId)).limit(1),
    db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, parsed.data.vehicleId)).limit(1),
  ]);
  if (!route[0] || !vehicle[0]) return NextResponse.json({ error: 'Güzergah veya araç bulunamadı.' }, { status: 404 });

  try {
    const [rule] = await db.transaction(async (tx) => {
      if (parsed.data.active) {
        await tx.update(routePriceRules).set({
          active: false,
          updatedAt: new Date(),
          updatedBy: session.adminId,
        }).where(and(
          eq(routePriceRules.routeId, parsed.data.routeId),
          eq(routePriceRules.vehicleId, parsed.data.vehicleId),
          eq(routePriceRules.active, true),
        ));
      }
      return tx.update(routePriceRules).set({
        ...parsed.data,
        validFrom: null,
        validUntil: null,
        notes: parsed.data.notes || null,
        updatedAt: new Date(),
        updatedBy: session.adminId,
      }).where(eq(routePriceRules.id, id)).returning();
    });
    if (!rule) return NextResponse.json({ error: 'Fiyat kuralı bulunamadı.' }, { status: 404 });
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'UPDATE',
      entityType: 'RoutePriceRule',
      entityId: rule.id,
      metadata: { routeId: rule.routeId, vehicleId: rule.vehicleId, amountCents: rule.amountCents, currency: rule.currency },
    }).catch(() => {});
    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Price rule PUT error:', error);
    return NextResponse.json({ error: 'Fiyat kuralı güncellenemedi.' }, { status: 503 });
  }
}

/** DELETE /admin/api/price-rules/[id] — remove a rule and retain its audit event. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const [deleted] = await db.delete(routePriceRules).where(eq(routePriceRules.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: 'Fiyat kuralı bulunamadı.' }, { status: 404 });
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'DELETE',
      entityType: 'RoutePriceRule',
      entityId: deleted.id,
      metadata: { routeId: deleted.routeId, vehicleId: deleted.vehicleId },
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Price rule DELETE error:', error);
    return NextResponse.json({ error: 'Fiyat kuralı silinemedi.' }, { status: 503 });
  }
}