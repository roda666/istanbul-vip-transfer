/**
 * POST /admin/api/translations/jobs/[jobId]/tasks/[taskId]/run
 *
 * Executes one translation task synchronously.
 * Max 2 attempts per task (tracked in translation_job_tasks.attempts).
 * Updates job-level counters after each task completes.
 *
 * The frontend calls this with max concurrency 2 so individual requests
 * stay well within Replit/Next.js timeout limits (~60s each).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { translationJobs, translationJobTasks } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

const MAX_ATTEMPTS = 2;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; taskId: string }> },
) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId, taskId } = await params;

  // ── Load job + task ───────────────────────────────────────────────────────
  const [job] = await db
    .select()
    .from(translationJobs)
    .where(eq(translationJobs.id, jobId))
    .limit(1);

  if (!job) return NextResponse.json({ error: 'İş bulunamadı.' }, { status: 404 });

  const [task] = await db
    .select()
    .from(translationJobTasks)
    .where(and(eq(translationJobTasks.id, taskId), eq(translationJobTasks.jobId, jobId)))
    .limit(1);

  if (!task) return NextResponse.json({ error: 'Görev bulunamadı.' }, { status: 404 });

  // Skip already completed or cancelled tasks
  if (task.status === 'COMPLETED') {
    return NextResponse.json({ status: 'completed', taskId, skipped: true });
  }
  if (task.status === 'CANCELLED') {
    return NextResponse.json({ status: 'cancelled', taskId });
  }
  if (task.status === 'RUNNING') {
    return NextResponse.json(
      { status: 'running', taskId, error: 'Bu çeviri görevi zaten çalışıyor.' },
      { status: 409 },
    );
  }

  // Enforce max attempts
  const nextAttempt = (task.attempts ?? 0) + 1;
  if (nextAttempt > MAX_ATTEMPTS) {
    await db
      .update(translationJobTasks)
      .set({ status: 'FAILED', errorMessage: `Maksimum deneme sayısına ulaşıldı (${MAX_ATTEMPTS}).`, updatedAt: sql`now()` })
      .where(eq(translationJobTasks.id, taskId));
    await syncJobCounters(jobId);
    return NextResponse.json({ status: 'failed', taskId, error: 'Maksimum deneme sayısına ulaşıldı.' });
  }

  // Mark as RUNNING
  const [claimedTask] = await db
    .update(translationJobTasks)
    .set({ status: 'RUNNING', attempts: nextAttempt, startedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(
      eq(translationJobTasks.id, taskId),
      inArray(translationJobTasks.status, ['QUEUED', 'RETRYING']),
    ))
    .returning({ id: translationJobTasks.id });

  // A second browser tab may have claimed the task after the initial read.
  // Do not make a duplicate provider request in that race.
  if (!claimedTask) {
    return NextResponse.json(
      { status: 'running', taskId, error: 'Bu çeviri görevi başka bir oturum tarafından başlatıldı.' },
      { status: 409 },
    );
  }

  // ── Execute task ──────────────────────────────────────────────────────────
  const { runTranslationTask } = await import('@/lib/translation-job-runner');

  const result = await runTranslationTask({
    jobId,
    taskId,
    entityType: job.entityType as 'content' | 'service_page' | 'faq' | 'vehicle' | 'navigation',
    entityId:   job.entityId,
    targetLang: task.targetLanguageCode,
    force:      job.force,
    adminId:    session.adminId,
    attempt:    nextAttempt,
  });

  // ── Update task status ────────────────────────────────────────────────────
  if (result.status === 'completed') {
    await db
      .update(translationJobTasks)
      .set({
        status: 'COMPLETED',
        translationId: result.translationId ?? null,
        completedAt: sql`now()`,
        updatedAt: sql`now()`,
        errorMessage: null,
      })
      .where(eq(translationJobTasks.id, taskId));
  } else if (result.status === 'needs_confirmation') {
    // Soft failure — can be force-retried
    await db
      .update(translationJobTasks)
      .set({
        status: 'FAILED',
        errorMessage: result.error ?? 'Elle düzenlenmiş — onay gerekli.',
        updatedAt: sql`now()`,
      })
      .where(eq(translationJobTasks.id, taskId));
  } else {
    // Failed — allow retry if attempts < MAX_ATTEMPTS
    const newStatus = nextAttempt < MAX_ATTEMPTS ? 'RETRYING' : 'FAILED';
    await db
      .update(translationJobTasks)
      .set({
        status: newStatus,
        errorMessage: result.error ?? 'Bilinmeyen hata.',
        updatedAt: sql`now()`,
      })
      .where(eq(translationJobTasks.id, taskId));
  }

  // ── Sync job counters ─────────────────────────────────────────────────────
  await syncJobCounters(jobId);

  return NextResponse.json({ status: result.status, taskId, translationId: result.translationId, error: result.error });
}

/** Recalculate completed/failed counts and set parent job status. */
async function syncJobCounters(jobId: string) {
  const tasks = await db
    .select({ status: translationJobTasks.status })
    .from(translationJobTasks)
    .where(eq(translationJobTasks.jobId, jobId));

  const total     = tasks.length;
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
  const failed    = tasks.filter((t) => t.status === 'FAILED' || t.status === 'CANCELLED').length;
  const pending   = tasks.filter((t) => ['QUEUED', 'RUNNING', 'RETRYING'].includes(t.status)).length;

  let jobStatus = 'RUNNING';
  if (pending === 0) {
    if (failed === 0)         jobStatus = 'COMPLETED';
    else if (completed === 0) jobStatus = 'FAILED';
    else                      jobStatus = 'PARTIAL';
  }

  await db
    .update(translationJobs)
    .set({
      completedTasks: completed,
      failedTasks:    failed,
      totalTasks:     total,
      status:         jobStatus,
      updatedAt:      sql`now()`,
      completedAt:    pending === 0 ? sql`now()` : null,
    })
    .where(eq(translationJobs.id, jobId));
}
