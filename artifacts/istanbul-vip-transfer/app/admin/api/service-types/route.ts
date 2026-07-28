import { NextResponse } from 'next/server';

/** GET /admin/api/service-types — list all service types */
export async function GET() {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await import('@/db');
    const { serviceTypes } = await import('@/db/schema');
    const { asc } = await import('drizzle-orm');
    const items = await db.select().from(serviceTypes).orderBy(asc(serviceTypes.displayOrder));
    return NextResponse.json({ items });
  } catch (err) {
    console.error('Service types list error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
