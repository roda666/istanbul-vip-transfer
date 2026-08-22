import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, priceCalculatorSettings } from '@/db/schema';

export const dynamic = 'force-dynamic';

const featureSchema = z.object({ enabled: z.boolean() });

/** GET /admin/api/price-calculator — operational state for the hidden feature. */
export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db
      .select({ enabled: priceCalculatorSettings.enabled, updatedAt: priceCalculatorSettings.updatedAt })
      .from(priceCalculatorSettings)
      .where(eq(priceCalculatorSettings.id, 1))
      .limit(1);
    return NextResponse.json({ settings: rows[0] ?? { enabled: false, updatedAt: null } });
  } catch (error) {
    console.error('Price calculator settings GET error:', error);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** PUT /admin/api/price-calculator — turns public estimate access on or off. */
export async function PUT(request: NextRequest) {
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
  const parsed = featureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz özellik ayarı.' }, { status: 422 });
  }

  try {
    const [settings] = await db
      .insert(priceCalculatorSettings)
      .values({ id: 1, enabled: parsed.data.enabled, updatedAt: new Date(), updatedBy: session.adminId })
      .onConflictDoUpdate({
        target: priceCalculatorSettings.id,
        set: { enabled: parsed.data.enabled, updatedAt: new Date(), updatedBy: session.adminId },
      })
      .returning({ enabled: priceCalculatorSettings.enabled, updatedAt: priceCalculatorSettings.updatedAt });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'UPDATE',
      entityType: 'PriceCalculatorSettings',
      entityId: '1',
      metadata: { enabled: parsed.data.enabled },
    }).catch(() => {});

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Price calculator settings PUT error:', error);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}