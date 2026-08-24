import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';

type QueuedTask = { jobId: string; taskId: string };

/**
 * Creates durable, per-language jobs for every active service page. The client
 * runs these tasks through the existing two-concurrency runner, rather than
 * holding one very long request open for the entire catalog.
 */
export async function POST() {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI çeviri servisi yapılandırılmamış.' }, { status: 503 });
  }

  const { db } = await import('@/db');
  const { content, languages, translationJobs, translationJobTasks } = await import('@/db/schema');
  const { and, desc, eq } = await import('drizzle-orm');

  const [services, localeRows] = await Promise.all([
    db.select({ id: content.id })
      .from(content)
      .where(and(
        eq(content.contentType, 'SERVICE'),
        eq(content.isActive, true),
      )),
    db.select({ code: languages.code })
      .from(languages)
      .where(and(
        eq(languages.isEnabled, true),
        eq(languages.providerSupported, true),
      )),
  ]);

  const targetLocales = localeRows.map((row) => row.code).filter((code) => code !== 'tr');
  if (services.length === 0 || targetLocales.length === 0) {
    return NextResponse.json({
      error: 'Çevrilecek aktif hizmet veya etkin hedef dil bulunamadı.',
    }, { status: 422 });
  }

  const queuedTasks: QueuedTask[] = [];

  for (const service of services) {
    const [latestJob] = await db
      .select()
      .from(translationJobs)
      .where(and(
        eq(translationJobs.entityType, 'service_page'),
        eq(translationJobs.entityId, service.id),
      ))
      .orderBy(desc(translationJobs.createdAt))
      .limit(1);

    let jobId: string;
    if (latestJob && ['QUEUED', 'RUNNING', 'PARTIAL'].includes(latestJob.status)) {
      jobId = latestJob.id;
    } else {
      const [createdJob] = await db
        .insert(translationJobs)
        .values({
          entityType: 'service_page',
          entityId: service.id,
          status: 'RUNNING',
          force: false,
          totalTasks: targetLocales.length,
          completedTasks: 0,
          failedTasks: 0,
          createdBy: session.adminId,
        })
        .returning({ id: translationJobs.id });
      jobId = createdJob.id;

      await db.insert(translationJobTasks).values(
        targetLocales.map((targetLanguageCode) => ({
          jobId,
          targetLanguageCode,
          status: 'QUEUED',
          attempts: 0,
        })),
      );
    }

    const tasks = await db
      .select({ id: translationJobTasks.id, status: translationJobTasks.status })
      .from(translationJobTasks)
      .where(eq(translationJobTasks.jobId, jobId));

    queuedTasks.push(
      ...tasks
        .filter((task) => ['QUEUED', 'RETRYING'].includes(task.status))
        .map((task) => ({ jobId, taskId: task.id })),
    );
  }

  return NextResponse.json({
    queuedTasks,
    serviceCount: services.length,
    localeCount: targetLocales.length,
  });
}