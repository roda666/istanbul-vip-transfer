import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { getTollPricingSettings, updateTollPricingSettings } from '@/lib/toll-management';

export const dynamic = 'force-dynamic';

const settingsSchema = z.object({
  staleAfterDays: z.number().int().min(1).max(3650),
  warnOnNewYearRollover: z.boolean(),
});

/** GET /admin/api/pricing/tolls/settings — the configurable staleness/time-band thresholds. */
export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const settings = await getTollPricingSettings();
  return NextResponse.json({ settings });
}

/** PUT /admin/api/pricing/tolls/settings — update the staleness threshold and day/night cutover hours. */
export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? 'Geçersiz ayar.' }, { status: 422 });
  }
  const settings = await updateTollPricingSettings({ ...payload.data, updatedBy: session.adminId });
  return NextResponse.json({ settings });
}
