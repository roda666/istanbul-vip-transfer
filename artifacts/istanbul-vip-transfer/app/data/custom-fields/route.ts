/**
 * Public API: fetch active custom reservation fields for a service slug.
 * GET /data/custom-fields?slug=istanbul-havalimani-transfer
 * No auth required. 60-second CDN cache.
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { customReservationFields } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get('slug') ?? '').trim();

  const allActive = await db
    .select()
    .from(customReservationFields)
    .where(eq(customReservationFields.isActive, true))
    .orderBy(asc(customReservationFields.sortOrder), asc(customReservationFields.id));

  // Filter to fields that apply to this slug (or apply to all if slug is empty)
  const relevant = slug
    ? allActive.filter(f => {
        const slugs = (f.appliesToSlugs as string[] | null) ?? [];
        return slugs.length === 0 || slugs.includes(slug);
      })
    : allActive.filter(f => {
        const slugs = (f.appliesToSlugs as string[] | null) ?? [];
        return slugs.length === 0;
      });

  return NextResponse.json({ fields: relevant }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
  });
}
