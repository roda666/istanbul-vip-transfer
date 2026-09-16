/**
 * Durable orchestration contract for customer-visible CMS translations.
 *
 * This module only creates durable work. It never calls an AI provider, so
 * source publish/update requests can return immediately after the transaction
 * commits. The existing task runner remains responsible for provider calls and
 * quality gates.
 */
import 'server-only';
import { createHash } from 'node:crypto';

export const CUSTOMER_TRANSLATION_LOCALES = [
  'en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl',
] as const;
export type CustomerTranslationLocale = typeof CUSTOMER_TRANSLATION_LOCALES[number];

export type CustomerContentEntityType =
  | 'content'
  | 'service_page'
  | 'faq'
  | 'category'
  | 'transfer_route'
  | 'homepage'
  | 'navigation';

const ACTIVE_JOB_STATUSES = ['QUEUED', 'RUNNING', 'PARTIAL'] as const;

export function computeCustomerContentSourceHash(snapshot: unknown): string {
  const canonicalize = (value: unknown): unknown => {
    if (value === undefined) return null;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(canonicalize);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  };
  return createHash('sha256').update(JSON.stringify(canonicalize(snapshot))).digest('hex');
}

/**
 * translation_jobs.entity_id is UUID-shaped for historical reasons. Categories
 * use serial IDs, so adapters receive a deterministic UUID that never collides
 * with a real source ID. The original numeric ID remains in the adapter payload
 * owned by the category endpoint.
 */
export function customerTranslationEntityId(entityType: CustomerContentEntityType, entityId: string): string {
  if (entityType !== 'category') return entityId;
  const digest = createHash('sha1').update(`customer-category:${entityId}`).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export interface EnqueueCustomerTranslationsInput {
  entityType: CustomerContentEntityType;
  entityId: string;
  sourceHash: string;
  adminId?: string | null;
  /** Category adapter's numeric source ID, retained for future task runners. */
  sourceAdapterId?: string;
  force?: boolean;
}

export interface EnqueueCustomerTranslationsResult {
  jobId: string;
  created: boolean;
  taskCount: number;
  locales: readonly CustomerTranslationLocale[];
}

export interface CustomerTranslationProviderInput {
  entityType: CustomerContentEntityType;
  entityId: string;
  targetLanguageCode: CustomerTranslationLocale;
  sourceHash: string;
}

export interface CustomerTranslationProviderResult {
  ok: boolean;
  fields?: Record<string, string | null>;
  error?: string;
}

/** Test seam: production remains provider-free until the durable task runner executes. */
export type CustomerTranslationProvider = (
  input: CustomerTranslationProviderInput,
) => Promise<CustomerTranslationProviderResult>;

let testProvider: CustomerTranslationProvider | null = null;

export function installCustomerTranslationTestProvider(provider: CustomerTranslationProvider | null): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test çeviri sağlayıcısı yalnızca test ortamında kurulabilir.');
  testProvider = provider;
}

export async function runCustomerTranslationProvider(
  input: CustomerTranslationProviderInput,
): Promise<CustomerTranslationProviderResult> {
  if (testProvider) return testProvider(input);
  return { ok: false, error: 'Çeviri sağlayıcısı yalnızca kuyruk işçisi tarafından çağrılabilir.' };
}

/**
 * Marks stale translations and atomically creates exactly eight language tasks.
 * Existing valid published data is never cleared while replacement work runs.
 */
export async function enqueueCustomerContentTranslations(
  input: EnqueueCustomerTranslationsInput,
): Promise<EnqueueCustomerTranslationsResult> {
  const { db } = await import('@/db');
  const { contentTranslations, translationJobs, translationJobTasks } = await import('@/db/schema');
  const { and, eq, inArray, sql } = await import('drizzle-orm');
  const entityId = customerTranslationEntityId(input.entityType, input.entityId);

  return db.transaction(async (tx) => {
    // Serialize enqueue attempts for this logical source. The partial unique
    // index below is the second line of defense for independent workers.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${input.entityType}:${entityId}:${input.sourceHash}`}))`);
    const [active] = await tx
      .select({ id: translationJobs.id, totalTasks: translationJobs.totalTasks })
      .from(translationJobs)
      .where(and(
        eq(translationJobs.entityType, input.entityType),
        eq(translationJobs.entityId, entityId),
        eq(translationJobs.sourceHash, input.sourceHash),
        inArray(translationJobs.status, [...ACTIVE_JOB_STATUSES]),
      ))
      .limit(1);

    if (active) {
      return {
        jobId: active.id,
        created: false,
        taskCount: active.totalTasks,
        locales: CUSTOMER_TRANSLATION_LOCALES,
      };
    }

    // A source edit truthfully invalidates the status badge, but does not erase
    // the currently published translation. The runner replaces it atomically
    // only after a validated result is ready.
    if (input.entityType !== 'category' && input.entityType !== 'transfer_route') {
      await tx.update(contentTranslations)
        .set({ status: 'OUTDATED', updatedAt: new Date() } as never)
        .where(and(
          eq(contentTranslations.entityType, input.entityType === 'service_page' ? 'service_page' : input.entityType === 'homepage' ? 'homepage' : input.entityType === 'navigation' ? 'navigation' : input.entityType === 'faq' ? 'faq' : 'content'),
          eq(contentTranslations.entityId, input.entityId),
          inArray(contentTranslations.status, ['PUBLISHED', 'APPROVED']),
        ));
    }

    const [job] = await tx.insert(translationJobs).values({
      entityType: input.entityType,
      entityId,
      sourceHash: input.sourceHash,
      force: input.force ?? false,
      totalTasks: CUSTOMER_TRANSLATION_LOCALES.length,
      createdBy: input.adminId ?? null,
      status: 'QUEUED',
    }).returning({ id: translationJobs.id });
    if (!job) throw new Error('Çeviri kuyruğu oluşturulamadı.');

    await tx.insert(translationJobTasks).values(
      CUSTOMER_TRANSLATION_LOCALES.map(targetLanguageCode => ({
        jobId: job.id,
        targetLanguageCode,
        status: 'QUEUED',
      })),
    );

    return {
      jobId: job.id,
      created: true,
      taskCount: CUSTOMER_TRANSLATION_LOCALES.length,
      locales: CUSTOMER_TRANSLATION_LOCALES,
    };
  });
}

export async function retryCustomerTranslationJob(jobId: string, adminId?: string | null) {
  const { db } = await import('@/db');
  const { translationJobs, translationJobTasks } = await import('@/db/schema');
  const { and, eq, inArray } = await import('drizzle-orm');
  const [job] = await db.select().from(translationJobs).where(eq(translationJobs.id, jobId)).limit(1);
  if (!job) throw new Error('Çeviri işi bulunamadı.');
  await db.update(translationJobs).set({ status: 'QUEUED', failedTasks: 0, updatedAt: new Date(), createdBy: adminId ?? job.createdBy } as never).where(eq(translationJobs.id, jobId));
  await db.update(translationJobTasks)
    .set({ status: 'QUEUED', errorMessage: null, updatedAt: new Date() } as never)
    .where(and(eq(translationJobTasks.jobId, jobId), inArray(translationJobTasks.status, ['FAILED', 'RETRYING'])));
  return jobId;
}

/**
 * Atomically promotes a validated replacement. Callers must run their
 * type-specific adapter/quality gate before invoking this function.
 */
export async function publishValidatedCustomerTranslation(input: {
  translationId: string;
  sourceHash: string;
  fields: Record<string, string | null | undefined>;
  adminId?: string | null;
}) {
  const { db } = await import('@/db');
  const { contentTranslations } = await import('@/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const [row] = await db.update(contentTranslations).set({
    ...input.fields,
    sourceHash: input.sourceHash,
    status: 'PUBLISHED',
    publishedAt: new Date(),
    failureReason: null,
    updatedBy: input.adminId ?? null,
    updatedAt: new Date(),
  } as never).where(and(
    eq(contentTranslations.id, input.translationId),
    eq(contentTranslations.sourceHash, input.sourceHash),
  )).returning({ id: contentTranslations.id });
  return Boolean(row);
}