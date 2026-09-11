import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '@/db';
import { languages, translationJobTasks, translationJobs } from '@/db/schema';

/** Queue the complete enabled non-TR catalog exactly once for an optional service. */
export async function queueOptionalServiceTranslations(entityId: string, adminId: string) {
  const targets = await db.select({ code: languages.code }).from(languages)
    .where(and(eq(languages.isEnabled, true), ne(languages.code, 'tr'), ne(languages.providerSupported, false)));
  const codes = [...new Set(targets.map((row) => row.code))].slice(0, 8);
  if (codes.length === 0) return null;
  const [active] = await db.select().from(translationJobs).where(and(
    eq(translationJobs.entityType, 'optional_service'),
    eq(translationJobs.entityId, entityId),
    inArray(translationJobs.status, ['QUEUED', 'RUNNING', 'PARTIAL']),
  )).limit(1);
  if (active) {
    const tasks = await db.select().from(translationJobTasks).where(eq(translationJobTasks.jobId, active.id));
    return { job: active, tasks };
  }
  const [job] = await db.insert(translationJobs).values({
    entityType: 'optional_service', entityId, status: 'QUEUED', force: false,
    totalTasks: codes.length, createdBy: adminId,
  }).returning();
  if (!job) return null;
  const tasks = await db.insert(translationJobTasks).values(codes.map((targetLanguageCode) => ({
    jobId: job.id, targetLanguageCode, status: 'QUEUED', attempts: 0,
  }))).returning();
  return { job, tasks };
}