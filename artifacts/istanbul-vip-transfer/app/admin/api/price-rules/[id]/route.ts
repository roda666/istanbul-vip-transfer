import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, routePriceRules } from '@/db/schema';
import { isValidPriceWindow } from '@/lib/price-rules';
import { priceRuleSchema } from '../route';

export const dynamic = 'force-dynamic';

function toDates(data: { validFrom?: string | null; validUntil?: string | null }) {
  return {
    validFrom: data.validFrom ? new Date(data.validFrom) : null,
    validUntil: data.validUntil ? new Date(data.validUntil) : null,
  };
}

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
  const parsed = priceRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }
  const dates = toDates(parsed.data);
  if (!isValidPriceWindow(dates.validFrom, dates.validUntil)) {
    return NextResponse.json({ error: 'Bitiş tarihi başlangıç tarihinden önce olamaz.' }, { status: 422 });
  }

  // Reuse the POST route's overlap safeguards without trusting any client-side UI.
  const { routePriceRules: rules, transferRoutes, vehicles } = await import('@/db/schema');
  const { and } = await import('drizzle-orm');
  const conflicts = parsed.data.active ? await db
    .select({ id: rules.id, validFrom: rules.validFrom, validUntil: rules.validUntil })
    .from(rules)
    .where(and(eq(rules.routeId, parsed.data.routeId), eq(rules.vehicleId, parsed.data.vehicleId), eq(rules.active, true))) : [];
  const { priceRuleWindowsOverlap } = await import('@/lib/price-rules');
  if (conflicts.some((rule) => rule.id !== id && priceRuleWindowsOverlap(dates, rule))) {
    return NextResponse.json({ error: 'Bu rota ve araç için çakışan etkin bir fiyat dönemi zaten var.' }, { status: 409 });
  }
  const [route, vehicle] = await Promise.all([
    db.select({ id: transferRoutes.id }).from(transferRoutes).where(eq(transferRoutes.id, parsed.data.routeId)).limit(1),
    db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, parsed.data.vehicleId)).limit(1),
  ]);
  if (!route[0] || !vehicle[0]) return NextResponse.json({ error: 'Güzergah veya araç bulunamadı.' }, { status: 404 });

  try {
    const [rule] = await db.update(routePriceRules).set({
      ...parsed.data,
      ...dates,
      notes: parsed.data.notes || null,
      updatedAt: new Date(),
      updatedBy: session.adminId,
    }).where(eq(routePriceRules.id, id)).returning();
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
    if (isOverlapConstraintError(error)) {
      return NextResponse.json({ error: 'Bu rota ve araç için çakışan etkin bir fiyat dönemi zaten var.' }, { status: 409 });
    }
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