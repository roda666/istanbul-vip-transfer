import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, routePriceRules, transferRoutes, vehicles } from '@/db/schema';
import { priceRuleInputSchema } from '@/lib/price-rule-input';

export const dynamic = 'force-dynamic';

async function validateRuleReferences(routeId: string, vehicleId: string): Promise<string | null> {
  const [routes, vehicleRows] = await Promise.all([
    db.select({ id: transferRoutes.id }).from(transferRoutes).where(eq(transferRoutes.id, routeId)).limit(1),
    db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1),
  ]);
  if (!routes[0]) return 'Güzergah bulunamadı.';
  if (!vehicleRows[0]) return 'Araç bulunamadı.';
  return null;
}

/** GET /admin/api/price-rules — all rules plus dropdown data for the rule editor. */
export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [rules, routes, vehicleRows] = await Promise.all([
      db.select({
        id: routePriceRules.id,
        routeId: routePriceRules.routeId,
        vehicleId: routePriceRules.vehicleId,
        amountCents: routePriceRules.amountCents,
        currency: routePriceRules.currency,
        active: routePriceRules.active,
        validFrom: routePriceRules.validFrom,
        validUntil: routePriceRules.validUntil,
        notes: routePriceRules.notes,
        updatedAt: routePriceRules.updatedAt,
        routeName: transferRoutes.name,
        routeSlug: transferRoutes.slug,
        vehicleName: vehicles.name,
        vehicleSlug: vehicles.slug,
      }).from(routePriceRules)
        .innerJoin(transferRoutes, eq(routePriceRules.routeId, transferRoutes.id))
        .innerJoin(vehicles, eq(routePriceRules.vehicleId, vehicles.id))
        .orderBy(routePriceRules.updatedAt),
      db.select({ id: transferRoutes.id, name: transferRoutes.name, active: transferRoutes.active })
        .from(transferRoutes)
        .orderBy(transferRoutes.name),
      db.select({ id: vehicles.id, name: vehicles.name, status: vehicles.status })
        .from(vehicles)
        .orderBy(vehicles.name),
    ]);
    return NextResponse.json({ rules, routes, vehicles: vehicleRows });
  } catch (error) {
    console.error('Price rules GET error:', error);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** POST /admin/api/price-rules — create one route × vehicle estimate rule. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const data = parsed.data;
  try {
    const referenceError = await validateRuleReferences(data.routeId, data.vehicleId);
    if (referenceError) return NextResponse.json({ error: referenceError }, { status: 404 });
    const [rule] = await db.transaction(async (tx) => {
      // Legacy rules are now immediate and active/passive only. Keep previous
      // records for audit history, but ensure a route/vehicle has one active
      // legacy override so the historic exclusion constraint remains satisfied.
      if (data.active) {
        await tx.update(routePriceRules).set({
          active: false,
          updatedAt: new Date(),
          updatedBy: session.adminId,
        }).where(and(
          eq(routePriceRules.routeId, data.routeId),
          eq(routePriceRules.vehicleId, data.vehicleId),
          eq(routePriceRules.active, true),
        ));
      }
      return tx.insert(routePriceRules).values({
        ...data,
        validFrom: null,
        validUntil: null,
        notes: data.notes || null,
        createdBy: session.adminId,
        updatedBy: session.adminId,
      }).returning();
    });
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'CREATE',
      entityType: 'RoutePriceRule',
      entityId: rule.id,
      metadata: { routeId: rule.routeId, vehicleId: rule.vehicleId, amountCents: rule.amountCents, currency: rule.currency },
    }).catch(() => {});
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('Price rule POST error:', error);
    return NextResponse.json({ error: 'Fiyat kuralı kaydedilemedi.' }, { status: 503 });
  }
}