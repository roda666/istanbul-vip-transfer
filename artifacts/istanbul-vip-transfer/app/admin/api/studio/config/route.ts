/**
 * GET /admin/api/studio/config
 * Returns integration status: OpenAI, image generation, scheduler readiness.
 * No secrets are returned — only boolean connection state.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET() {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const openaiConfigured  = !!process.env.OPENAI_API_KEY;
  const imageConfigured   = openaiConfigured; // DALL-E uses same key
  const schedulerReady    = !!process.env.STUDIO_SCHEDULER_ENABLED;
  const storageConfigured = !!process.env.PRIVATE_OBJECT_DIR;
  const model             = process.env.OPENAI_CONTENT_MODEL ?? process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4o-mini';

  return NextResponse.json({
    openai: {
      configured: openaiConfigured,
      model,
      label: openaiConfigured ? `Bağlı (${model})` : 'Bağlı değil — OPENAI_API_KEY eksik',
    },
    imageGeneration: {
      configured: imageConfigured,
      model:      imageConfigured ? 'dall-e-3' : null,
      label:      imageConfigured ? 'DALL-E 3 bağlı' : 'Bağlı değil — görsel yükleme modunu kullanın',
    },
    scheduler: {
      ready: schedulerReady,
      label: schedulerReady ? 'Zamanlayıcı aktif' : 'Zamanlayıcı hazır değil — manuel yayın kullanın',
    },
    storage: {
      configured: storageConfigured,
      label:      storageConfigured ? 'Nesne depolama bağlı' : 'Nesne depolama yapılandırılmamış',
    },
    keywordData: {
      connected: false,
      label:     'Anahtar kelime verisi bağlı değil — AI tahmini kullanılıyor',
      providers: ['Google Search Console', 'Ahrefs', 'SEMrush'],
    },
  });
}
