import { NextRequest, NextResponse } from 'next/server';
import 'server-only';
import { requireAdminSession } from '@/lib/auth/session';
import { hasAdminPermission } from '@/lib/auth/authorization';
import {
  DEFAULT_DRAFT_CADENCE,
  getDraftCadenceSlot,
  isDraftCadencePeriod,
  nextDueAtWhenSavingCadence,
  schedulerGuidance,
  validateDraftCadenceInput,
} from '@/lib/studio/draft-cadence';

export const dynamic = 'force-dynamic';

function cadenceFailure(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  if (code === '42P01' || code === '42703') {
    return {
      status: 503,
      error: 'Taslak sıklığı şeması eksik. Sistem Kontrolü sayfasından migration ayrıntılarını inceleyip tekrar deneyin.',
    };
  }
  if (error instanceof Error && /timeout|abort/i.test(error.message)) {
    return { status: 503, error: 'Taslak sıklığı kontrolü zaman aşımına uğradı. Lütfen tekrar deneyin.' };
  }
  return { status: 500, error: 'Taslak sıklığı ayarları okunamadı.' };
}

async function getOrCreateSettings() {
  const { db } = await import('@/db');
  const { aiDraftCadenceSettings } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const now = new Date();
  const initialSlot = getDraftCadenceSlot(now, DEFAULT_DRAFT_CADENCE.period, DEFAULT_DRAFT_CADENCE.timezone);
  await db.insert(aiDraftCadenceSettings).values({
    id: 1,
    ...DEFAULT_DRAFT_CADENCE,
    nextDueAt: initialSlot.startsAt,
  }).onConflictDoNothing();
  const [settings] = await db.select().from(aiDraftCadenceSettings)
    .where(eq(aiDraftCadenceSettings.id, 1)).limit(1);
  return { db, aiDraftCadenceSettings, settings };
}

function safeCadence(settings: { period: string; quantity: number; timezone: string } | undefined) {
  const period = isDraftCadencePeriod(settings?.period) ? settings.period : DEFAULT_DRAFT_CADENCE.period;
  const quantity = settings && Number.isInteger(settings.quantity) && settings.quantity >= 1 && settings.quantity <= 10
    ? settings.quantity
    : DEFAULT_DRAFT_CADENCE.quantity;
  const timezone = settings?.timezone || DEFAULT_DRAFT_CADENCE.timezone;
  return { period, quantity, timezone };
}

export async function GET() {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!hasAdminPermission(session.role, 'AI_USE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { settings } = await getOrCreateSettings();
    const cadence = safeCadence(settings);
    return NextResponse.json({
      cadence: {
        ...cadence,
        lastExecutedAt: settings?.lastExecutedAt ?? null,
        nextDueAt: settings?.nextDueAt ?? null,
        updatedAt: settings?.updatedAt ?? null,
      },
      scheduler: schedulerGuidance(cadence.period),
    });
  } catch (error) {
    const failure = cadenceFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

export async function PATCH(req: NextRequest) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!hasAdminPermission(session.role, 'AI_USE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Geçerli JSON gerekli.' }, { status: 400 }); }
  const parsed = validateDraftCadenceInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { db, aiDraftCadenceSettings } = await getOrCreateSettings();
    const { aiDraftCadenceRuns, auditLogs } = await import('@/db/schema');
    const { eq, sql } = await import('drizzle-orm');
    const now = new Date();
    const currentSlot = getDraftCadenceSlot(now, parsed.value.period, parsed.value.timezone);
    const [currentSlotRun] = await db.select({ id: aiDraftCadenceRuns.id })
      .from(aiDraftCadenceRuns)
      .where(eq(aiDraftCadenceRuns.slotKey, currentSlot.key))
      .limit(1);
    const [settings] = await db.update(aiDraftCadenceSettings).set({
      ...parsed.value,
      nextDueAt: nextDueAtWhenSavingCadence(currentSlot, Boolean(currentSlotRun)),
      configVersion: sql`${aiDraftCadenceSettings.configVersion} + 1`,
      updatedAt: now,
      updatedBy: session.adminId as never,
    }).where(eq(aiDraftCadenceSettings.id, 1)).returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId as never,
      action: 'AI_DRAFT_CADENCE_UPDATED',
      entityType: 'AiDraftCadence',
      entityId: 'singleton',
      metadata: parsed.value,
    }).catch(() => {});

    return NextResponse.json({
      cadence: {
        ...safeCadence(settings),
        lastExecutedAt: settings?.lastExecutedAt ?? null,
        nextDueAt: settings?.nextDueAt ?? null,
        updatedAt: settings?.updatedAt ?? null,
      },
      scheduler: schedulerGuidance(parsed.value.period),
      message: 'Otomatik taslak sıklığı kaydedildi.',
    });
  } catch (error) {
    const failure = cadenceFailure(error);
    return NextResponse.json({
      error: failure.status === 500 ? 'Taslak sıklığı ayarları kaydedilemedi.' : failure.error,
    }, { status: failure.status });
  }
}