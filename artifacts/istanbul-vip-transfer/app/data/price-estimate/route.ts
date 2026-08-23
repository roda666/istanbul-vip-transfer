import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

/**
 * Public price calculation is deliberately unavailable. The admin pricing
 * engine lives behind authenticated /admin routes and never reuses this path.
 */
export async function POST() {
  return NextResponse.json({ error: 'Fiyat hesaplama yalnızca yönetici panelinde kullanılabilir.', code: 'ADMIN_ONLY' }, { status: 404 });
}