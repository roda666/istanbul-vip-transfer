import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { optionalServices } from '@/db/schema';

export const dynamic = 'force-dynamic';

/** Admin-only catalog read. Writes stay with the dedicated optional-services task. */
export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const services = await db
      .select({
        id: optionalServices.id,
        key: optionalServices.key,
        name: optionalServices.name,
        currency: optionalServices.currency,
        unitAmount: optionalServices.unitAmount,
        chargeType: optionalServices.chargeType,
        active: optionalServices.active,
      })
      .from(optionalServices)
      .orderBy(asc(optionalServices.displayOrder), asc(optionalServices.name));

    return NextResponse.json({ services });
  } catch (error) {
    console.error('Optional services GET error:', error);
    return NextResponse.json({ error: 'Ek hizmetler alınamadı.' }, { status: 503 });
  }
}