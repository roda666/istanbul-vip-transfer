/**
 * Recovery guard for browser-orchestrated translation jobs.
 *
 * Jobs are started from the admin browser. If that browser closes or the
 * request is interrupted, a task must not remain RUNNING forever or be
 * duplicated by a second tab.
 */
import 'server-only';

const STALE_TASK_MS = 10 * 60 * 1000;

export async function recoverStaleTranslationTasks(jobId: string): Promise<number> {
  const [{ db }, { translationJobTasks }, { and, eq, lt, sql }] = await Promise.all([
    import('@/db'),
    import('@/db/schema'),
    import('drizzle-orm'),
  ]);

  const staleBefore = new Date(Date.now() - STALE_TASK_MS);
  const recovered = await db.update(translationJobTasks)
    .set({
      status: 'RETRYING',
      errorMessage: 'Çeviri isteği kesildi; güvenle yeniden denenmeye hazır.',
      updatedAt: sql`now()`,
    })
    .where(and(
      eq(translationJobTasks.jobId, jobId),
      eq(translationJobTasks.status, 'RUNNING'),
      lt(translationJobTasks.startedAt, staleBefore),
    ))
    .returning({ id: translationJobTasks.id });

  return recovered.length;
}