import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, priceCalculatorSettings } from '@/db/schema';

export const dynamic = 'force-dynamic';

/** GET /admin/api/price-calculator — public pricing is permanently disabled. */
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
    return NextResponse.json({ settings: { enabled: false, updatedAt: rows[0]?.updatedAt ?? null, publicPricingLocked: true } });
  } catch (error) {
    console.error('Price calculator settings GET error:', error);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** PUT is retained only to migrate historic settings safely; it never enables public pricing. */
export async function PUT(_request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [settings] = await db
      .insert(priceCalculatorSettings)
      .values({ id: 1, enabled: false, updatedAt: new Date(), updatedBy: session.adminId })
      .onConflictDoUpdate({
        target: priceCalculatorSettings.id,
        set: { enabled: false, updatedAt: new Date(), updatedBy: session.adminId },
      })
      .returning({ enabled: priceCalculatorSettings.enabled, updatedAt: priceCalculatorSettings.updatedAt });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'UPDATE',
      entityType: 'PriceCalculatorSettings',
      entityId: '1',
      metadata: { enabled: false, publicPricingLocked: true },
    }).catch(() => {});

    return NextResponse.json({ settings: { ...settings, publicPricingLocked: true } });
  } catch (error) {
    console.error('Price calculator settings PUT error:', error);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}