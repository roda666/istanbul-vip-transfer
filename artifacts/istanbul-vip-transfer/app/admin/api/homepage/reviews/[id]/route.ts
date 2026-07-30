/**
 * PATCH /admin/api/homepage/reviews/[id]  — update review
 * DELETE /admin/api/homepage/reviews/[id] — delete review
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';

const updateSchema = z.object({
  reviewerName:   z.string().min(1).max(120).optional(),
  reviewText:     z.string().min(1).max(1000).optional(),
  rating:         z.number().int().min(1).max(5).optional(),
  reviewLanguage: z.enum(['tr', 'en', 'de', 'ru', 'ar']).optional(),
  reviewDate:     z.string().datetime().optional().nullable(),
  isVisible:      z.boolean().optional(),
  sortOrder:      z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Validation error' }, { status: 422 });
  }

  const data = parsed.data;
  try {
    const { db } = await import('@/db');
    const { googleReviews, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [updated] = await db
      .update(googleReviews)
      .set({
        ...data,
        reviewDate: data.reviewDate ? new Date(data.reviewDate) : (data.reviewDate === null ? null : undefined),
        updatedAt: new Date(),
      })
      .where(eq(googleReviews.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'REVIEW_UPDATE',
      entityType: 'google_review',
      entityId: id,
      metadata: { fields: Object.keys(data) },
    });

    return NextResponse.json({ review: updated });
  } catch (err) {
    console.error('Review PATCH error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 503 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { db } = await import('@/db');
    const { googleReviews, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [deleted] = await db.delete(googleReviews).where(eq(googleReviews.id, id)).returning({ id: googleReviews.id });
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'REVIEW_DELETE',
      entityType: 'google_review',
      entityId: id,
      metadata: {},
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Review DELETE error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 503 });
  }
}
