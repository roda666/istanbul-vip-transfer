/**
 * Admin API: custom reservation fields CRUD
 * GET  /admin/api/custom-fields         — list all
 * POST /admin/api/custom-fields         — create
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/db';
import { content, customReservationFields } from '@/db/schema';
import { asc, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select()
    .from(customReservationFields)
    .orderBy(asc(customReservationFields.sortOrder), asc(customReservationFields.id));

  const pageOptions = await db.select({ slug: content.slug, label: content.title })
    .from(content)
    .where(inArray(content.contentType, ['SERVICE', 'PAGE']))
    .orderBy(asc(content.title));

  return NextResponse.json({ fields: rows, pageOptions });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { label?: string; appliesToSlugs?: string[]; fieldType?: string; sortOrder?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }

  const label = (body.label ?? '').trim();
  if (!label) return NextResponse.json({ error: 'label required' }, { status: 400 });

  const [row] = await db.insert(customReservationFields).values({
    label,
    appliesToSlugs: body.appliesToSlugs ?? [],
    fieldType: body.fieldType ?? 'checkbox',
    sortOrder: body.sortOrder ?? 0,
  }).returning();

  const { revalidateBookingFormBootstrap } = await import('@/lib/booking-form-bootstrap');
  revalidateBookingFormBootstrap();
  return NextResponse.json({ field: row }, { status: 201 });
}
