import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { VEHICLE_FEATURE_CODES } from '@/lib/vehicle-feature-catalog';

const translationsSchema = z.object({
  tr: z.string().trim().min(1),
  en: z.string().trim().min(1),
  de: z.string().trim().min(1),
  ru: z.string().trim().min(1),
  ar: z.string().trim().min(1),
  fr: z.string().trim().min(1),
  es: z.string().trim().min(1),
  it: z.string().trim().min(1),
  nl: z.string().trim().min(1),
});

const settingsSchema = z.object({
  codes: z.array(z.enum(VEHICLE_FEATURE_CODES as [string, ...string[]])).max(VEHICLE_FEATURE_CODES.length),
  customFeatures: z.array(z.object({
    code: z.string().regex(/^CUSTOM_[A-Za-z0-9_-]+$/),
    translations: translationsSchema,
  })).max(50).default([]),
});

/** GET /admin/api/vehicle-feature-defaults */
export async function GET() {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/db');
  const { vehicleFeatureDefaults } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const { DEFAULT_VEHICLE_FEATURE_CODES } = await import('@/lib/vehicle-feature-catalog');

  const rows = await db
    .select()
    .from(vehicleFeatureDefaults)
    .where(eq(vehicleFeatureDefaults.id, 1))
    .limit(1)
    .catch(() => []);

  return NextResponse.json({
    codes: rows[0]?.codes ?? DEFAULT_VEHICLE_FEATURE_CODES,
    customFeatures: rows[0]?.customFeatures ?? [],
    isSeeded: rows.length > 0,
  });
}

/** PUT /admin/api/vehicle-feature-defaults */
export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }

  const { db } = await import('@/db');
  const { vehicleFeatureDefaults } = await import('@/db/schema');
  const { invalidateVehicleFeatureDefaults } = await import('@/lib/vehicle-feature-defaults-server');
  const now = new Date();

  const [row] = await db
    .insert(vehicleFeatureDefaults)
    .values({ id: 1, codes: parsed.data.codes, customFeatures: parsed.data.customFeatures, updatedAt: now, updatedBy: session.adminId })
    .onConflictDoUpdate({
      target: vehicleFeatureDefaults.id,
      set: { codes: parsed.data.codes, customFeatures: parsed.data.customFeatures, updatedAt: now, updatedBy: session.adminId },
    })
    .returning();

  invalidateVehicleFeatureDefaults();

  return NextResponse.json({ codes: row.codes, customFeatures: row.customFeatures });
}
