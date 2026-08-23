import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, flightMeetGreetSettings } from '@/db/schema';
import { getFlightMeetGreetStatus } from '@/lib/flight-meet-greet-server';

export const dynamic = 'force-dynamic';

const featureSchema = z.object({ enabled: z.boolean() });

/** GET /admin/api/flight-meet-greet — safe operational status, never credentials. */
export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json({ status: await getFlightMeetGreetStatus() });
  } catch (error) {
    console.error('Flight meet & greet settings GET error:', error);
    return NextResponse.json({ error: 'Uçuş karşılama durumu alınamadı.' }, { status: 503 });
  }
}

/**
 * PUT /admin/api/flight-meet-greet — permits closing the feature. Enabling is
 * deliberately rejected until a future server-only provider is configured.
 */
export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }
  const parsed = featureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz özellik ayarı.' }, { status: 422 });
  }

  try {
    const currentStatus = await getFlightMeetGreetStatus();
    if (parsed.data.enabled && !currentStatus.provider.configured) {
      return NextResponse.json({
        error: 'Uçuş sağlayıcısı yapılandırılmadan özellik açılamaz.',
        code: 'PROVIDER_NOT_CONFIGURED',
      }, { status: 409 });
    }

    await db
      .insert(flightMeetGreetSettings)
      .values({ id: 1, enabled: parsed.data.enabled, updatedAt: new Date(), updatedBy: session.adminId })
      .onConflictDoUpdate({
        target: flightMeetGreetSettings.id,
        set: { enabled: parsed.data.enabled, updatedAt: new Date(), updatedBy: session.adminId },
      });

    const status = await getFlightMeetGreetStatus();
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'UPDATE',
      entityType: 'FlightMeetGreetSettings',
      entityId: '1',
      metadata: { enabled: status.enabled, providerId: status.provider.id },
    }).catch(() => {});

    return NextResponse.json({ status });
  } catch (error) {
    console.error('Flight meet & greet settings PUT error:', error);
    return NextResponse.json({ error: 'Uçuş karşılama ayarı kaydedilemedi.' }, { status: 503 });
  }
}