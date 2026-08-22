/**
 * GET /admin/api/translations/jobs/[jobId]
 *
 * Returns the job with all its tasks.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';

export async function GET(
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
  const { eq } = await import('drizzle-orm');

  const [job] = await db
    .select()
    .from(translationJobs)
    .where(eq(translationJobs.id, jobId))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: 'İş bulunamadı.' }, { status: 404 });
  }

  const { recoverStaleTranslationTasks } = await import('@/lib/translation-job-recovery');
  const recoveredTasks = await recoverStaleTranslationTasks(jobId);
  const tasks = await db
    .select()
    .from(translationJobTasks)
    .where(eq(translationJobTasks.jobId, jobId));

  return NextResponse.json({ job, tasks, recoveredTasks });
}
