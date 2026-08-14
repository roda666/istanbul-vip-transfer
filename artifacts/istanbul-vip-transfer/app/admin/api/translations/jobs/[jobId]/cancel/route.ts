/**
 * POST /admin/api/translations/jobs/[jobId]/cancel
 *
 * Cancels all QUEUED and RETRYING tasks in the job.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await params;

  const { db } = await import('@/db');
  const { translationJobs, translationJobTasks } = await import('@/db/schema');
  const { eq, and, inArray, sql } = await import('drizzle-orm');

  const [job] = await db
    .select()
    .from(translationJobs)
    .where(eq(translationJobs.id, jobId))
    .limit(1);

  if (!job) return NextResponse.json({ error: 'İş bulunamadı.' }, { status: 404 });

  await db
    .update(translationJobTasks)
    .set({ status: 'CANCELLED', updatedAt: sql`now()` })
    .where(
      and(
        eq(translationJobTasks.jobId, jobId),
        inArray(translationJobTasks.status, ['QUEUED', 'RETRYING']),
      )
    );

  await db
    .update(translationJobs)
    .set({ status: 'CANCELLED', updatedAt: sql`now()`, completedAt: sql`now()` })
    .where(eq(translationJobs.id, jobId));

  return NextResponse.json({ ok: true });
}
