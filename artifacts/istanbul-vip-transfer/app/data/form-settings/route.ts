/**
 * GET /data/form-settings
 * Public route — returns booking form field visibility settings.
 * No authentication required; fields are non-sensitive booleans.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const { NextResponse } = await import('next/server');
  try {
    const { db } = await import('@/db');
    const { siteSettings } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const rows = await db
      .select({
        showLuggageCount:     siteSettings.showLuggageCount,
        showChildSeatCount:   siteSettings.showChildSeatCount,
        showVehiclePreference: siteSettings.showVehiclePreference,
        showAdditionalNotes:  siteSettings.showAdditionalNotes,
      })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);

    const defaults = {
      showLuggageCount:     false,
      showChildSeatCount:   false,
      showVehiclePreference: false,
      showAdditionalNotes:  false,
    };
    return NextResponse.json(rows[0] ?? defaults, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({
      showLuggageCount:     false,
      showChildSeatCount:   false,
      showVehiclePreference: false,
      showAdditionalNotes:  false,
    });
  }
}
