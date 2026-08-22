import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { hasAdminPermission } from '@/lib/auth/authorization';
import { generateAdminFieldDraft } from '@/lib/studio/ai-studio';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  context: z.enum(['blog', 'service', 'homepage', 'chatbot', 'faq']),
  field: z.enum(['title', 'body', 'description', 'short_text', 'cta', 'seo_title', 'seo_description', 'faq_question', 'faq_answer', 'chatbot_answer']),
  fieldLabel: z.string().trim().min(1).max(100),
  currentText: z.string().max(12_000).default(''),
  language: z.enum(['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl']).default('tr'),
  maxLength: z.number().int().min(20).max(12_000).optional(),
});

const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;

function allowed(adminId: string) {
  const now = Date.now();
  const current = rateLimits.get(adminId);
  if (!current || current.resetAt <= now) {
    rateLimits.set(adminId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Oturum doğrulanamadı.' }, { status: 401 });
  }
  if (!hasAdminPermission(session.role, 'AI_USE')) {
    return NextResponse.json({ error: 'Bu işlem için AI kullanım yetkiniz yok.' }, { status: 403 });
  }
  if (!allowed(session.adminId)) {
    return NextResponse.json({ error: 'Çok fazla AI isteği gönderildi. Lütfen bir dakika sonra tekrar deneyin.' }, { status: 429 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Gönderilen alan bilgisi geçersiz.' }, { status: 400 });
  }

  const result = await generateAdminFieldDraft(parsed.data);
  if (!result.ok) {
    const status = result.reason === 'not_configured' ? 503 : result.reason === 'rate_limited' ? 429 : 422;
    return NextResponse.json({ error: result.message }, { status });
  }

  // Observability only: the draft text itself is intentionally never logged.
  try {
    const [{ db }, { auditLogs }] = await Promise.all([import('@/db'), import('@/db/schema')]);
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'AI_FIELD_GENERATE',
      entityType: parsed.data.context,
      metadata: {
        field: parsed.data.field,
        language: parsed.data.language,
        sourceLength: parsed.data.currentText.length,
        outputLength: result.data.text.length,
      },
    } as never);
  } catch {
    // Audit availability must not block a safe, non-persisting draft.
  }

  return NextResponse.json({ text: result.data.text });
}