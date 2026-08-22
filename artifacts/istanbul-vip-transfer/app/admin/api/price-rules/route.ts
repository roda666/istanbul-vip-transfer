import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, routePriceRules, transferRoutes, vehicles } from '@/db/schema';
import {
  isValidPriceWindow,
  priceRuleWindowsOverlap,
  SUPPORTED_PRICE_CURRENCIES,
} from '@/lib/price-rules';

export const dynamic = 'force-dynamic';

const optionalIsoDate = z.string().datetime({ offset: true }).nullable().optional();
export const priceRuleSchema = z.object({
  routeId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  amountCents: z.number().int().min(1).max(100_000_000),
  currency: z.enum(SUPPORTED_PRICE_CURRENCIES),
  active: z.boolean().default(true),
  validFrom: optionalIsoDate,
  validUntil: optionalIsoDate,
  notes: z.string().trim().max(1_000).nullable().optional(),
});

type PriceRuleInput = z.infer<typeof priceRuleSchema>;

function isOverlapConstraintError(error: unknown): boolean {
  const candidate = error as {
    constraint?: string;
    cause?: { constraint?: string; code?: string; message?: string };
  };
  return candidate?.constraint === 'route_price_rules_no_active_window_overlap'
    || candidate?.cause?.constraint === 'route_price_rules_no_active_window_overlap'
    || (candidate?.cause?.code === '23P01'
      && candidate.cause.message?.includes('route_price_rules_no_active_window_overlap') === true);
}

function toDates(data: PriceRuleInput) {
  return {
    validFrom: data.validFrom ? new Date(data.validFrom) : null,
    validUntil: data.validUntil ? new Date(data.validUntil) : null,
  };
}

async function validateRuleReferences(routeId: string, vehicleId: string): Promise<string | null> {
  const [routes, vehicleRows] = await Promise.all([
    db.select({ id: transferRoutes.id }).from(transferRoutes).where(eq(transferRoutes.id, routeId)).limit(1),
    db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1),
  ]);
  if (!routes[0]) return 'Güzergah bulunamadı.';
  if (!vehicleRows[0]) return 'Araç bulunamadı.';
  return null;
}

async function hasConflictingActiveWindow(
  data: PriceRuleInput,
  excludeId?: string,
): Promise<boolean> {
  if (!data.active) return false;
  const existing = await db
    .select({
      id: routePriceRules.id,
      validFrom: routePriceRules.validFrom,
      validUntil: routePriceRules.validUntil,
      active: routePriceRules.active,
    })
    .from(routePriceRules)
    .where(and(
      eq(routePriceRules.routeId, data.routeId),
      eq(routePriceRules.vehicleId, data.vehicleId),
      eq(routePriceRules.active, true),
    ));
  const nextWindow = toDates(data);
  return existing.some((rule) =>
    rule.id !== excludeId && priceRuleWindowsOverlap(nextWindow, rule),
  );
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
  const parsed = priceRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }
  const data = parsed.data;
  const dates = toDates(data);
  if (!isValidPriceWindow(dates.validFrom, dates.validUntil)) {
    return NextResponse.json({ error: 'Bitiş tarihi başlangıç tarihinden önce olamaz.' }, { status: 422 });
  }

  try {
    const referenceError = await validateRuleReferences(data.routeId, data.vehicleId);
    if (referenceError) return NextResponse.json({ error: referenceError }, { status: 404 });
    if (await hasConflictingActiveWindow(data)) {
      return NextResponse.json({ error: 'Bu rota ve araç için çakışan etkin bir fiyat dönemi zaten var.' }, { status: 409 });
    }
    const [rule] = await db.insert(routePriceRules).values({
      ...data,
      ...dates,
      notes: data.notes || null,
      createdBy: session.adminId,
      updatedBy: session.adminId,
    }).returning();
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'CREATE',
      entityType: 'RoutePriceRule',
      entityId: rule.id,
      metadata: { routeId: rule.routeId, vehicleId: rule.vehicleId, amountCents: rule.amountCents, currency: rule.currency },
    }).catch(() => {});
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    if (isOverlapConstraintError(error)) {
      return NextResponse.json({ error: 'Bu rota ve araç için çakışan etkin bir fiyat dönemi zaten var.' }, { status: 409 });
    }
    console.error('Price rule POST error:', error);
    return NextResponse.json({ error: 'Fiyat kuralı kaydedilemedi.' }, { status: 503 });
  }
}