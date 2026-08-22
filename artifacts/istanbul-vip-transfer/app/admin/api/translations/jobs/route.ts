/**
 * POST /admin/api/translations/jobs
 *
 * Creates a translation job + one task per target language.
 * Returns immediately — the frontend orchestrates per-task execution.
 *
 * Idempotency: if a QUEUED or RUNNING job already exists for this entity,
 * returns it instead of creating a duplicate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';

const bodySchema = z.object({
  entityType: z.enum(['content', 'service_page', 'faq', 'vehicle', 'navigation']),
  entityId:   z.string().uuid(),
  targetLanguageCodes: z.array(z.string().min(2).max(10)).min(1).max(80),
  force: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI çeviri servisi yapılandırılmamış (OPENAI_API_KEY eksik).' },
      { status: 503 },
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz istek', details: parsed.error.issues }, { status: 400 });
  }

  const { entityType, entityId, targetLanguageCodes, force } = parsed.data;

  const { db } = await import('@/db');
  const { translationJobs, translationJobTasks, languages } = await import('@/db/schema');
  const { eq, and, inArray, sql } = await import('drizzle-orm');

  // ── Validate target languages ────────────────────────────────────────────
  const catalogRows = await db
    .select({ code: languages.code, providerSupported: languages.providerSupported })
    .from(languages)
    .where(inArray(languages.code, targetLanguageCodes));
  const catalog = new Map(catalogRows.map(r => [r.code, r]));
  const invalid = targetLanguageCodes.filter(c => c === 'tr' || !catalog.has(c));
  const unsupported = targetLanguageCodes.filter(c => catalog.get(c)?.providerSupported === false);
  if (invalid.length > 0 || unsupported.length > 0) {
    return NextResponse.json({
      error: [
        invalid.length > 0 ? `Katalogda olmayan diller: ${invalid.join(', ')}` : null,
        unsupported.length > 0 ? `Desteklenmeyen diller: ${unsupported.join(', ')}` : null,
      ].filter(Boolean).join(' — '),
    }, { status: 400 });
  }

  // ── Idempotency: return active job if one already exists ─────────────────
  const [existing] = await db
    .select()
    .from(translationJobs)
    .where(
      and(
        eq(translationJobs.entityType, entityType),
        eq(translationJobs.entityId, entityId),
        // Only reuse active/unfinished jobs
      )
    )
    .orderBy(sql`created_at DESC`)
    .limit(1);

  // Only reuse if the job is still active (not completed/cancelled)
  if (existing && ['QUEUED', 'RUNNING', 'PARTIAL'].includes(existing.status)) {
    const { recoverStaleTranslationTasks } = await import('@/lib/translation-job-recovery');
    const recoveredTasks = await recoverStaleTranslationTasks(existing.id);
    const tasks = await db
      .select()
      .from(translationJobTasks)
      .where(eq(translationJobTasks.jobId, existing.id));
    return NextResponse.json({ job: existing, tasks, recoveredTasks }, { status: 200 });
  }

  // ── Create new job ────────────────────────────────────────────────────────
  const [job] = await db
    .insert(translationJobs)
    .values({
      entityType,
      entityId,
      status: 'QUEUED',
      force,
      totalTasks: targetLanguageCodes.length,
      completedTasks: 0,
      failedTasks: 0,
      createdBy: session.adminId,
    })
    .returning();

  // ── Create one task per language ──────────────────────────────────────────
  const tasks = await db
    .insert(translationJobTasks)
    .values(
      targetLanguageCodes.map(lang => ({
        jobId: job.id,
        targetLanguageCode: lang,
        status: 'QUEUED',
        attempts: 0,
      }))
    )
    .returning();

  // Update job to RUNNING now that tasks are created
  await db
    .update(translationJobs)
    .set({ status: 'RUNNING', updatedAt: sql`now()` })
    .where(eq(translationJobs.id, job.id));

  return NextResponse.json({ job: { ...job, status: 'RUNNING' }, tasks }, { status: 201 });
}
