/**
 * GET /admin/api/studio/config
 * Real, bounded capability checks for the AI Studio system-control screen.
 * The response contains only operational status and safe labels—never keys,
 * signed URLs, provider payloads, connection strings, or raw error messages.
 */
import { NextResponse } from 'next/server';
import 'server-only';
import { requireAdminSession } from '@/lib/auth/session';
import { getOpenAiModel } from '@/lib/ai/model-config';
import {
  probeDatabase,
  probeObjectStorage,
  probeStudioMigrations,
  probeStudioScheduler,
  type ServiceHealth,
} from '@/lib/studio/system-health';

export const dynamic = 'force-dynamic';

const targetLanguages = [
  { code: 'tr', name: 'Türkçe', role: 'source' },
  { code: 'en', name: 'İngilizce', role: 'target' },
  { code: 'de', name: 'Almanca', role: 'target' },
  { code: 'ru', name: 'Rusça', role: 'target' },
  { code: 'ar', name: 'Arapça (RTL)', role: 'target' },
  { code: 'fr', name: 'Fransızca', role: 'target' },
  { code: 'es', name: 'İspanyolca', role: 'target' },
  { code: 'it', name: 'İtalyanca', role: 'target' },
  { code: 'nl', name: 'Felemenkçe', role: 'target' },
] as const;

function unavailable(label: string): ServiceHealth {
  return { status: 'error', label };
}

export async function GET() {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const model = getOpenAiModel();
  const openaiConfigured = Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);

  let runtime: { db: typeof import('@/db').db; sql: typeof import('drizzle-orm').sql } | null = null;
  try {
    const [{ db }, { sql }] = await Promise.all([import('@/db'), import('drizzle-orm')]);
    runtime = { db, sql };
  } catch {
    // Individual checks below return a safe, retryable failure state.
  }

  const dbCheck = runtime
    ? probeDatabase(() => runtime!.db.execute(runtime!.sql`SELECT 1`))
    : Promise.resolve(unavailable('Veritabanı denetimi başlatılamadı — tekrar deneyin'));

  const cmsCheck = runtime
    ? probeDatabase(async () => {
        const { content } = await import('@/db/schema');
        await runtime!.db.select({ n: runtime!.sql<number>`count(*)` }).from(content).limit(1);
      }).then((result) => ({
        ...result,
        label: result.status === 'ok' ? 'CMS DRAFT aktarımı sorgulanabiliyor' : 'CMS tablosuna erişilemiyor',
      }))
    : Promise.resolve(unavailable('CMS denetimi başlatılamadı — tekrar deneyin'));

  const migrationCheck = runtime
    ? probeStudioMigrations((query) => runtime!.db.execute(query as never), runtime!.sql.raw)
    : Promise.resolve({
        ...unavailable('Studio şema denetimi başlatılamadı — tekrar deneyin'),
        missing: [],
      });

  const openAiCheck = openaiConfigured
    ? import('@/lib/studio/ai-studio').then(({ checkOpenAIConnectivity }) => checkOpenAIConnectivity())
    : Promise.resolve({
        chat: { ok: false, model: null, error: 'AI metin servisi yapılandırılmamış.' },
        image: { ok: false, model: process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2', error: 'AI görsel servisi yapılandırılmamış.' },
      });

  const googleAdsCheck = import('@/lib/google-ads').then(({ getGoogleAdsStatus }) => getGoogleAdsStatus())
    .catch(() => ({ connected: false, ready: false, label: 'Google Ads bağlantı durumu okunamadı — tekrar deneyin' }));
  const [database, cms, migrations, storage, openai, googleAds] = await Promise.all([
    dbCheck,
    cmsCheck,
    migrationCheck,
    probeObjectStorage(process.env.PRIVATE_OBJECT_DIR),
    openAiCheck,
    googleAdsCheck,
  ]);

  const scheduler = probeStudioScheduler({
    enabledFlag: process.env.STUDIO_SCHEDULER_ENABLED,
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    migrations,
  });

  const chat = {
    configured: openaiConfigured,
    ok: openai.chat.ok,
    model: openai.chat.model ?? model,
    status: !openaiConfigured ? 'warn' as const : openai.chat.ok ? 'ok' as const : 'error' as const,
    label: !openaiConfigured
      ? 'AI metin modeli yapılandırılmamış (Replit AI veya OpenAI bağlantısı gerekli)'
      : openai.chat.ok
        ? `Metin modeli yanıt veriyor (${openai.chat.model ?? model})`
        : openai.chat.error ?? 'Metin modeli kontrolü başarısız — tekrar deneyin',
  };
  const imageGeneration = {
    configured: openaiConfigured,
    ok: openai.image.ok,
    model: openai.image.ok ? openai.image.model : null,
    status: !openaiConfigured ? 'warn' as const : openai.image.ok ? 'ok' as const : 'error' as const,
    label: !openaiConfigured
      ? 'Görsel üretimi yapılandırılmamış (Replit AI veya OpenAI bağlantısı gerekli)'
      : openai.image.ok
        ? 'DALL-E 3 model erişimi doğrulandı'
        : openai.image.error ?? 'DALL-E 3 erişimi doğrulanamadı — tekrar deneyin',
  };
  const translation = {
    status: chat.status,
    ok: chat.ok,
    label: chat.ok
      ? 'Çeviri için metin modeli ve dokuz dil kataloğu hazır'
      : !openaiConfigured
        ? 'Çeviri için AI metin modeli yapılandırılmamış'
        : 'Çeviri için metin modeli erişilemiyor',
  };

  let studioProjects: number | null = null;
  if (runtime && database.status === 'ok') {
    try {
      const { studioProjects: projects } = await import('@/db/schema');
      const [row] = await runtime.db.select({ n: runtime.sql<number>`count(*)` }).from(projects);
      studioProjects = Number(row?.n ?? 0);
    } catch {
      // A count is presentation-only; the database and migration cards retain
      // their own truthful state.
    }
  }

  return NextResponse.json({
    database: {
      ...database,
      studioProjects,
      migration: migrations,
    },
    openai: chat,
    imageGeneration,
    storage,
    scheduler,
    cms,
    translation,
    languages: targetLanguages.map((language) => ({
      ...language,
      configured: language.role === 'source' || translation.ok,
    })),
    keywordData: {
      connected: googleAds.ready,
      label: googleAds.label,
      providers: [
        googleAds.ready ? 'Google Ads Keyword Planner (Türkiye / Türkçe, hazır)' : 'Google Ads Keyword Planner (kullanılamıyor)',
        'Google Search Console (bu kontrol ekranında doğrulanmadı)',
      ],
    },
    social: {
      newsletter: { connected: false, label: 'Bülten entegrasyonu yok — yalnızca taslak oluşturulur' },
      instagram: { connected: false, label: 'Instagram API bağlı değil — yalnızca taslak' },
      facebook: { connected: false, label: 'Facebook API bağlı değil — yalnızca taslak' },
      twitter: { connected: false, label: 'Twitter/X API bağlı değil — yalnızca taslak' },
      linkedin: { connected: false, label: 'LinkedIn API bağlı değil — yalnızca taslak' },
    },
    checkedAt: new Date().toISOString(),
  });
}