/**
 * POST /admin/api/translations/ai
 *
 * Triggers AI translation for one content entity across one or more languages.
 * Creates or resets jobs to QUEUED, processes them, stores results as DRAFT.
 * AI translations NEVER advance past DRAFT automatically.
 *
 * Rate limit: 10 requests per minute per admin (in-memory, resets on server restart).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';

const requestSchema = z.object({
  entityType: z.literal('content'),
  entityId: z.string().uuid(),
  targetLanguageCodes: z.array(z.string().min(2).max(10)).min(1).max(5),
});

// Simple in-memory rate limiting (resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(adminId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(adminId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(adminId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkRateLimit(session.adminId)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maksimum dakikada 10 çeviri isteği yapılabilir.' },
      { status: 429 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI çeviri servisi yapılandırılmamış. OPENAI_API_KEY gereklidir.' },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  const { entityType, entityId, targetLanguageCodes } = parsed.data;

  const { db } = await import('@/db');
  const { content, contentTranslations, auditLogs } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const { sql } = await import('drizzle-orm');
  const { translateContent, PROMPT_VERSION } = await import('@/lib/ai/translate');

  // Fetch source content
  const [sourceContent] = await db.select().from(content).where(eq(content.id, entityId)).limit(1).catch(() => []);
  if (!sourceContent) {
    return NextResponse.json({ error: 'Source content not found' }, { status: 404 });
  }

  const results: Array<{ lang: string; status: string; jobId?: string; error?: string }> = [];

  for (const targetLang of targetLanguageCodes) {
    try {
      // Check if a translation job already exists for this entity+lang
      const [existing] = await db
        .select({ id: contentTranslations.id })
        .from(contentTranslations)
        .where(
          and(
            eq(contentTranslations.entityType, entityType),
            eq(contentTranslations.entityId, entityId),
            eq(contentTranslations.targetLanguageCode, targetLang),
          ),
        )
        .limit(1);

      let jobId: string;

      if (existing) {
        // Reset existing job to QUEUED
        await db
          .update(contentTranslations)
          .set({
            status: 'QUEUED',
            isAiGenerated: true,
            queuedAt: sql`now()`,
            updatedAt: sql`now()`,
            updatedBy: session.adminId,
            failureReason: null,
          })
          .where(eq(contentTranslations.id, existing.id));
        jobId = existing.id;
      } else {
        // Insert new job
        const [inserted] = await db
          .insert(contentTranslations)
          .values({
            entityType,
            entityId,
            targetLanguageCode: targetLang,
            sourceLanguageCode: 'tr',
            status: 'QUEUED',
            isAiGenerated: true,
            queuedAt: sql`now()`,
            createdBy: session.adminId,
            updatedBy: session.adminId,
          })
          .returning({ id: contentTranslations.id });
        if (!inserted) {
          results.push({ lang: targetLang, status: 'error', error: 'Failed to create job' });
          continue;
        }
        jobId = inserted.id;
      }

      // Mark as TRANSLATING
      await db
        .update(contentTranslations)
        .set({ status: 'TRANSLATING', updatedAt: sql`now()` })
        .where(eq(contentTranslations.id, jobId));

      // Call OpenAI
      const aiResult = await translateContent(
        {
          title: sourceContent.title,
          slug: sourceContent.slug,
          excerpt: sourceContent.excerpt,
          body: sourceContent.body,
          metaTitle: sourceContent.seoTitle,
          metaDescription: sourceContent.seoDescription,
          imageAlt: sourceContent.heroImageAlt,
        },
        targetLang,
      );

      if (!aiResult.ok) {
        await db
          .update(contentTranslations)
          .set({
            status: 'FAILED',
            failureReason: aiResult.message ?? aiResult.reason,
            updatedAt: sql`now()`,
          })
          .where(eq(contentTranslations.id, jobId));
        results.push({ lang: targetLang, status: 'failed', jobId, error: aiResult.message });
        continue;
      }

      // Save as DRAFT — NEVER APPROVED or PUBLISHED
      await db
        .update(contentTranslations)
        .set({
          status: 'DRAFT',
          updatedAt: sql`now()`,
          title: aiResult.data.title,
          slug: aiResult.data.slug,
          excerpt: aiResult.data.excerpt,
          body: aiResult.data.body,
          metaTitle: aiResult.data.metaTitle,
          metaDescription: aiResult.data.metaDescription,
          focusKeyword: aiResult.data.focusKeyword,
          supportingKeywords: aiResult.data.supportingKeywords,
          imageAlt: aiResult.data.imageAlt,
          imageTitle: aiResult.data.imageTitle,
          imageCaption: aiResult.data.imageCaption,
          aiModel: aiResult.model,
          aiPromptVersion: PROMPT_VERSION,
        })
        .where(eq(contentTranslations.id, jobId));

      await db.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: 'translation.ai_complete',
        entityType: 'content_translation',
        entityId: jobId,
        metadata: { targetLang, entityId, model: aiResult.model, status: 'DRAFT' },
      });

      results.push({ lang: targetLang, status: 'draft', jobId });
    } catch (err) {
      console.error(`AI translation failed for ${targetLang}:`, err);
      results.push({ lang: targetLang, status: 'error', error: String(err) });
    }
  }

  const allOk = results.every((r) => r.status === 'draft');
  const anyFailed = results.some((r) => ['error', 'failed'].includes(r.status));

  return NextResponse.json(
    { results, summary: allOk ? 'all_ok' : anyFailed ? 'partial_failure' : 'processing' },
    { status: anyFailed ? 207 : 200 },
  );
}
