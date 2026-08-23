/**
 * GET /admin/api/homepage/reviews  — list all reviews (admin)
 * POST /admin/api/homepage/reviews — create a new review
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { ALL_LOCALE_CODES } from '@/lib/i18n/locale-registry';

const createSchema = z.object({
  reviewerName: z.string().min(1).max(120),
  reviewText:   z.string().min(1).max(1000),
  rating:       z.number().int().min(1).max(5).default(5),
  reviewLanguage: z.enum(ALL_LOCALE_CODES).default('tr'),
  reviewDate:   z.string().datetime().optional().nullable(),
  isVisible:    z.boolean().default(true),
  sortOrder:    z.number().int().default(0),
});

export async function GET() {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await import('@/db');
    const { googleReviews } = await import('@/db/schema');
    const { asc } = await import('drizzle-orm');
    const rows = await db.select().from(googleReviews).orderBy(asc(googleReviews.sortOrder), asc(googleReviews.createdAt));
    return NextResponse.json({ reviews: rows });
  } catch (err) {
    console.error('Reviews GET error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Validation error' }, { status: 422 });
  }

  const data = parsed.data;
  try {
    const { db } = await import('@/db');
    const { googleReviews, auditLogs } = await import('@/db/schema');

    const [review] = await db.insert(googleReviews).values({
      reviewerName:          data.reviewerName,
      reviewText:            data.reviewText,
      rating:                data.rating,
      reviewLanguage:        data.reviewLanguage,
      reviewDate:            data.reviewDate ? new Date(data.reviewDate) : null,
      isVisible:             data.isVisible,
      sortOrder:             data.sortOrder,
      // Manually entered content must never be presented as a Google review.
      googleSourceIndicator: false,
    }).returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'REVIEW_CREATE',
      entityType: 'google_review',
      entityId: review.id,
      metadata: { reviewerName: data.reviewerName },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    console.error('Review create error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 503 });
  }
}
