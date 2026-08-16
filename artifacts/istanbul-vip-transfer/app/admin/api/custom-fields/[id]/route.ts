/**
 * Admin API: single custom field operations
 * PATCH  /admin/api/custom-fields/[id]  — update
 * DELETE /admin/api/custom-fields/[id]  — delete
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/db';
import { customReservationFields } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  let body: Partial<{ label: string; appliesToSlugs: string[]; fieldType: string; isActive: boolean; sortOrder: number }>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (body.label !== undefined)          updates.label            = body.label.trim();
  if (body.appliesToSlugs !== undefined) updates.appliesToSlugs   = body.appliesToSlugs;
  if (body.fieldType !== undefined)      updates.fieldType        = body.fieldType;
  if (body.isActive !== undefined)       updates.isActive         = body.isActive;
  if (body.sortOrder !== undefined)      updates.sortOrder        = body.sortOrder;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  const [row] = await db
    .update(customReservationFields)
    .set(updates)
    .where(eq(customReservationFields.id, numId))
    .returning();

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ field: row });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  await db.delete(customReservationFields).where(eq(customReservationFields.id, numId));
  return NextResponse.json({ ok: true });
}
