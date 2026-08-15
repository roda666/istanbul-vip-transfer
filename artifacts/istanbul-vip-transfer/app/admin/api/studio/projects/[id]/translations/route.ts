/**
 * GET  /admin/api/studio/projects/[id]/translations  — list all translations
 * POST /admin/api/studio/projects/[id]/translations  — start translation for selected langs
 *   Body: { langs: string[] }
 *   Guard: TR draft must be approved first.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { TARGET_LANGS } from '@/lib/studio/types';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { db } = await import('@/db');
  const { studioProjectTranslations } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const translations = await db.select().from(studioProjectTranslations)
    .where(eq(studioProjectTranslations.projectId, id));

  return NextResponse.json({ translations });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const body = await req.json() as { langs?: string[] };
  const reqLangs = (body.langs ?? TARGET_LANGS as unknown as string[]).filter(l => TARGET_LANGS.includes(l as never));
  if (reqLangs.length === 0) {
    return NextResponse.json({ error: 'Geçerli hedef dil seçilmedi.' }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { studioProjects, studioProjectTranslations, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq, and, inArray } = await import('drizzle-orm');

  const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });

  // ── GUARD: Turkish draft must be approved ─────────────────────────────────
  if (!project.trApprovedAt) {
    return NextResponse.json({
      error: 'Çeviri başlatmadan önce Türkçe taslağı onaylamanız gerekiyor.',
    }, { status: 400 });
  }
  if (!project.trContent) {
    return NextResponse.json({ error: 'Türkçe taslak mevcut değil.' }, { status: 400 });
  }

  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);

  const { translateStudioContent } = await import('@/lib/studio/ai-studio');
  const trContent = project.trContent as unknown as import('@/lib/studio/types').StudioContent;
  const results: Array<{ lang: string; status: 'draft' | 'error'; error?: string }> = [];
  const now = new Date();

  for (const lang of reqLangs) {
    const result = await translateStudioContent(trContent, lang);
    if (result.ok) {
      // Upsert translation
      const existing = await db.select({ id: studioProjectTranslations.id })
        .from(studioProjectTranslations)
        .where(and(eq(studioProjectTranslations.projectId, id), eq(studioProjectTranslations.lang, lang)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(studioProjectTranslations).set({
          content:     result.data as never,
          status:      'draft',
          approvedAt:  null,
          approvedBy:  null,
          publishedAt: null,
          aiModel:     result.model,
          aiTokens:    result.tokens ?? 0,
          updatedAt:   now,
        }).where(eq(studioProjectTranslations.id, existing[0].id));
      } else {
        await db.insert(studioProjectTranslations).values({
          projectId:  id,
          lang,
          content:    result.data as never,
          status:     'draft',
          aiModel:    result.model,
          aiTokens:   result.tokens ?? 0,
          createdAt:  now,
          updatedAt:  now,
        });
      }
      results.push({ lang, status: 'draft' });
    } else {
      results.push({ lang, status: 'error', error: result.message });
    }
  }

  // Advance stage
  const anyOk = results.some(r => r.status === 'draft');
  if (anyOk) {
    await db.update(studioProjects).set({ stage: 'translations', updatedAt: now })
      .where(eq(studioProjects.id, id));
  }

  await db.insert(studioAudit).values({
    projectId: id, adminId: admin?.id ?? null,
    action: 'translations_started',
    detail: { langs: reqLangs, results },
    createdAt: now,
  });

  return NextResponse.json({ results });
}
