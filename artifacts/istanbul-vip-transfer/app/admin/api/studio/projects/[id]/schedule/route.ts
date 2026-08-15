/**
 * GET  /admin/api/studio/projects/[id]/schedule  — get current schedule
 * POST /admin/api/studio/projects/[id]/schedule  — create/update schedule
 *   Body: { scheduledFor: ISO string; langs: string[] }
 *
 * Only approved translations can be scheduled.
 * Idempotency key prevents double-publish.
 * Scheduler status shown as 'hazır değil' if no cron is configured.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { db } = await import('@/db');
  const { studioSchedules } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const [schedule] = await db.select().from(studioSchedules)
    .where(eq(studioSchedules.projectId, id))
    .orderBy(desc(studioSchedules.createdAt))
    .limit(1);

  // Scheduler readiness: check for env var or cron config
  const schedulerReady = !!process.env.STUDIO_SCHEDULER_ENABLED;

  return NextResponse.json({ schedule: schedule ?? null, schedulerReady });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const body = await req.json() as { scheduledFor?: string; langs?: string[]; cancel?: boolean };

  const { db } = await import('@/db');
  const { studioProjects, studioProjectTranslations, studioSchedules, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq, and, inArray } = await import('drizzle-orm');

  const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });

  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);
  const now = new Date();

  if (body.cancel) {
    await db.update(studioSchedules)
      .set({ status: 'cancelled' })
      .where(and(eq(studioSchedules.projectId, id), eq(studioSchedules.status, 'pending')));
    await db.update(studioProjects).set({ status: 'approved', scheduledFor: null, updatedAt: now })
      .where(eq(studioProjects.id, id));
    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'schedule_cancelled', detail: {}, createdAt: now,
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.scheduledFor) {
    return NextResponse.json({ error: 'scheduledFor (ISO tarih) gerekli.' }, { status: 400 });
  }
  const scheduledDate = new Date(body.scheduledFor);
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= now) {
    return NextResponse.json({ error: 'Yayın tarihi gelecekte bir zaman olmalı.' }, { status: 400 });
  }

  const langsToSchedule = body.langs ?? [];
  if (langsToSchedule.length === 0) {
    return NextResponse.json({ error: 'En az bir dil seçmelisiniz.' }, { status: 400 });
  }

  // Verify only approved translations
  if (langsToSchedule.length > 0) {
    const translations = await db.select().from(studioProjectTranslations)
      .where(and(eq(studioProjectTranslations.projectId, id), inArray(studioProjectTranslations.lang, langsToSchedule)));
    const notApproved = langsToSchedule.filter(l =>
      !translations.find(t => t.lang === l && t.status === 'approved')
    );
    if (notApproved.length > 0) {
      return NextResponse.json({
        error: `Şu diller onaylanmamış: ${notApproved.map(l => l.toUpperCase()).join(', ')}. Planlamadan önce onaylayın.`,
      }, { status: 400 });
    }
  }

  // Check TR approval for include
  if (!project.trApprovedAt) {
    return NextResponse.json({ error: 'Türkçe taslak onaylanmadan zamanlama yapılamaz.' }, { status: 400 });
  }

  // Cancel any pending schedule
  await db.update(studioSchedules)
    .set({ status: 'cancelled' })
    .where(and(eq(studioSchedules.projectId, id), eq(studioSchedules.status, 'pending')));

  // Create new schedule with idempotency key
  const idempotencyKey = `${id}:${scheduledDate.toISOString()}:${langsToSchedule.sort().join(',')}`;

  const [schedule] = await db.insert(studioSchedules).values({
    projectId:      id,
    scheduledFor:   scheduledDate,
    langs:          langsToSchedule,
    idempotencyKey,
    status:         'pending',
    createdAt:      now,
  }).onConflictDoUpdate({
    target: [studioSchedules.idempotencyKey],
    set:    { status: 'pending' },
  } as never).returning();

  await db.update(studioProjects).set({
    status:      'scheduled',
    scheduledFor: scheduledDate,
    stage:       'scheduling',
    updatedAt:   now,
  }).where(eq(studioProjects.id, id));

  await db.insert(studioAudit).values({
    projectId: id, adminId: admin?.id ?? null,
    action: 'schedule_created',
    detail: { scheduledFor: scheduledDate.toISOString(), langs: langsToSchedule, idempotencyKey },
    createdAt: now,
  });

  return NextResponse.json({ schedule, schedulerReady: !!process.env.STUDIO_SCHEDULER_ENABLED });
}
