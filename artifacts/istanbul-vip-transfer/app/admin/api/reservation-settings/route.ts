import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const settingsSchema = z.object({
  timeStepMinutes: z.number().int().min(1).max(60).optional(),
  exactAddressRequired: z.boolean().optional(),
  locationSearchEnabled: z.boolean().optional(),
  roadDistanceMultiplier: z.number().finite().min(1).max(3).optional(),
  // Booking form field visibility
  showLuggageCount:      z.boolean().optional(),
  showChildSeatCount:    z.boolean().optional(),
  showVehiclePreference: z.boolean().optional(),
  showAdditionalNotes:   z.boolean().optional(),
});

const DEFAULTS = {
  timeStepMinutes: 5,
  exactAddressRequired: false,
  locationSearchEnabled: true,
  roadDistanceMultiplier: 1.25,
  showLuggageCount:      false,
  showChildSeatCount:    false,
  showVehiclePreference: false,
  showAdditionalNotes:   false,
};

/** GET /admin/api/reservation-settings */
export async function GET() {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await import('@/db');
    const { siteSettings } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const rows = await db
      .select({
        timeStepMinutes:       siteSettings.timeStepMinutes,
        exactAddressRequired:  siteSettings.exactAddressRequired,
        locationSearchEnabled: siteSettings.locationSearchEnabled,
        roadDistanceMultiplier: siteSettings.roadDistanceMultiplier,
        showLuggageCount:      siteSettings.showLuggageCount,
        showChildSeatCount:    siteSettings.showChildSeatCount,
        showVehiclePreference: siteSettings.showVehiclePreference,
        showAdditionalNotes:   siteSettings.showAdditionalNotes,
        updatedAt:             siteSettings.updatedAt,
      })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);

    return NextResponse.json({ settings: rows[0] ?? DEFAULTS });
  } catch (err) {
    console.error('Reservation settings GET error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** POST /admin/api/reservation-settings */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json'))
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' },
      { status: 422 },
    );

  const data = parsed.data;

  try {
    const { db } = await import('@/db');
    const { siteSettings, auditLogs } = await import('@/db/schema');

    const [updated] = await db
      .insert(siteSettings)
      .values({ id: 1, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteSettings.id, set: { ...data, updatedAt: new Date() } })
      .returning({
        timeStepMinutes:       siteSettings.timeStepMinutes,
        exactAddressRequired:  siteSettings.exactAddressRequired,
        locationSearchEnabled: siteSettings.locationSearchEnabled,
        roadDistanceMultiplier: siteSettings.roadDistanceMultiplier,
        showLuggageCount:      siteSettings.showLuggageCount,
        showChildSeatCount:    siteSettings.showChildSeatCount,
        showVehiclePreference: siteSettings.showVehiclePreference,
        showAdditionalNotes:   siteSettings.showAdditionalNotes,
        updatedAt:             siteSettings.updatedAt,
      });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'UPDATE',
      entityType: 'ReservationSettings',
      entityId: '1',
      metadata: data,
    }).catch(() => {});

    return NextResponse.json({ settings: updated });
  } catch (err) {
    console.error('Reservation settings POST error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
