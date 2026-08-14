/**
 * POST /admin/api/translations/jobs/[jobId]/retry-failed
 *
 * Resets all FAILED tasks to QUEUED so the frontend can re-run them.
 * Also accepts { force: true } to override manually-locked translations.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await params;
  const body = await request.json().catch(() => ({})) as { force?: boolean };
  const forceOverride = body.force === true;

  const { db } = await import('@/db');
  const { translationJobs, translationJobTasks } = await import('@/db/schema');
  const { eq, and, sql } = await import('drizzle-orm');

  const [job] = await db
    .select()
    .from(translationJobs)
    .where(eq(translationJobs.id, jobId))
    .limit(1);

  if (!job) return NextResponse.json({ error: 'İş bulunamadı.' }, { status: 404 });

  // Reset failed tasks to QUEUED and reset attempt counter
  await db
    .update(translationJobTasks)
    .set({ status: 'QUEUED', attempts: 0, errorMessage: null, updatedAt: sql`now()` })
    .where(
      and(
        eq(translationJobTasks.jobId, jobId),
        eq(translationJobTasks.status, 'FAILED'),
      )
    );

  // If force-overriding, update the job's force flag
  if (forceOverride) {
    await db
      .update(translationJobs)
      .set({ force: true, status: 'RUNNING', updatedAt: sql`now()`, completedAt: null })
      .where(eq(translationJobs.id, jobId));
  } else {
    await db
      .update(translationJobs)
      .set({ status: 'RUNNING', updatedAt: sql`now()`, completedAt: null })
      .where(eq(translationJobs.id, jobId));
  }

  // Return refreshed tasks
  const tasks = await db
    .select()
    .from(translationJobTasks)
    .where(eq(translationJobTasks.jobId, jobId));

  return NextResponse.json({ ok: true, tasks });
}
