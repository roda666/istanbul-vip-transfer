/**
 * GET /admin/api/studio/config
 * Returns full integration status for the System Check panel.
 * No secrets are returned — only boolean connection state and safe labels.
 *
 * Checks performed:
 *  - Database: lightweight ping query
 *  - OpenAI text model: real API call (ping — 5 tokens)
 *  - DALL-E 3: inferred from OpenAI key availability
 *  - Object storage: env var presence
 *  - 9-language matrix: always returns full list with configured = true
 *  - Scheduler: env flag
 *  - Google Search Console: not connected
 *  - Social/newsletter: not connected
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { getOpenAiModel } from '@/lib/ai/model-config';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET() {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const model             = getOpenAiModel();
  const openaiKeyPresent  = !!process.env.OPENAI_API_KEY;
  const schedulerReady    = !!process.env.STUDIO_SCHEDULER_ENABLED;
  const storageConfigured = !!process.env.PRIVATE_OBJECT_DIR;

  // ── Real DB ping ──────────────────────────────────────────────────────────
  let dbOk = false;
  let dbError: string | null = null;
  try {
    const { db } = await import('@/db');
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (e: unknown) {
    dbError = e instanceof Error ? e.message.slice(0, 120) : 'Veritabanı bağlantı hatası.';
  }

  // ── OpenAI real connectivity check ────────────────────────────────────────
  let openaiOk = false;
  let dalleAvailable = false;
  let openaiError: string | null = null;

  if (openaiKeyPresent) {
    try {
      const { checkOpenAIConnectivity } = await import('@/lib/studio/ai-studio');
      const result = await checkOpenAIConnectivity();
      openaiOk       = result.ok;
      dalleAvailable  = result.dalleAvailable;
      openaiError     = result.error ?? null;
    } catch {
      openaiError = 'Bağlantı kontrolü başarısız.';
    }
  }

  // ── CMS slug check ────────────────────────────────────────────────────────
  let cmsOk = false;
  try {
    const { db } = await import('@/db');
    const { content } = await import('@/db/schema');
    const { sql } = await import('drizzle-orm');
    await db.select({ n: sql<number>`count(*)` }).from(content).limit(1);
    cmsOk = true;
  } catch { /* ignore */ }

  // ── Studio table health check ─────────────────────────────────────────────
  const studioTables = [
    'studio_projects', 'studio_project_translations', 'studio_images',
    'studio_research', 'studio_distribution', 'studio_audit', 'studio_schedules',
  ];
  const studioTableStatus: Record<string, boolean> = {};
  let studioMigrationApplied = true;
  try {
    const { db } = await import('@/db');
    const { sql: drizzleSql } = await import('drizzle-orm');
    for (const t of studioTables) {
      try {
        await db.execute(drizzleSql.raw(`SELECT 1 FROM ${t} LIMIT 0`));
        studioTableStatus[t] = true;
      } catch {
        studioTableStatus[t] = false;
        studioMigrationApplied = false;
      }
    }
  } catch { studioMigrationApplied = false; }

  let studioCount = 0;
  try {
    const { db } = await import('@/db');
    const { studioProjects } = await import('@/db/schema');
    const { sql } = await import('drizzle-orm');
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(studioProjects);
    studioCount = Number(row?.n ?? 0);
  } catch { /* ignore */ }

  // ── 9 Language matrix ─────────────────────────────────────────────────────
  const languages = [
    { code: 'tr', name: 'Türkçe',      role: 'source',    configured: true },
    { code: 'en', name: 'İngilizce',   role: 'target',    configured: openaiOk },
    { code: 'de', name: 'Almanca',     role: 'target',    configured: openaiOk },
    { code: 'ru', name: 'Rusça',       role: 'target',    configured: openaiOk },
    { code: 'ar', name: 'Arapça (RTL)', role: 'target',   configured: openaiOk },
    { code: 'fr', name: 'Fransızca',   role: 'target',    configured: openaiOk },
    { code: 'es', name: 'İspanyolca',  role: 'target',    configured: openaiOk },
    { code: 'it', name: 'İtalyanca',   role: 'target',    configured: openaiOk },
    { code: 'nl', name: 'Felemenkçe',  role: 'target',    configured: openaiOk },
  ];

  return NextResponse.json({
    database: {
      ok: dbOk,
      label: dbOk ? 'Veritabanı bağlı' : `Veritabanı hatası: ${dbError ?? 'bilinmiyor'}`,
      studioProjects:   studioCount,
      migrationApplied: studioMigrationApplied,
      tables:           studioTableStatus,
      migrationGuide:   studioMigrationApplied
        ? null
        : 'Dev: psql $DATABASE_URL < drizzle/migrations/0016_studio.sql — güvenli, veri silinmez. Prod: pnpm db:migrate çalıştırın.',
    },
    openai: {
      configured: openaiKeyPresent,
      ok:         openaiOk,
      model,
      label: !openaiKeyPresent
        ? 'Bağlı değil — OPENAI_API_KEY eksik'
        : openaiOk
          ? `Bağlı ve çalışıyor (${model})`
          : `Anahtar mevcut ama erişim başarısız: ${openaiError ?? 'bilinmiyor'}`,
    },
    imageGeneration: {
      configured: openaiKeyPresent,
      ok:         dalleAvailable,
      model:      dalleAvailable ? 'dall-e-3' : null,
      label: !openaiKeyPresent
        ? 'Bağlı değil — OPENAI_API_KEY eksik'
        : dalleAvailable
          ? 'DALL-E 3 bağlı ve kullanıma hazır'
          : `DALL-E 3 erişilemiyor: ${openaiError ?? 'kota/erişim sorunu olabilir'}`,
    },
    storage: {
      configured: storageConfigured,
      label: storageConfigured
        ? 'Nesne depolama yapılandırılmış (PRIVATE_OBJECT_DIR)'
        : 'Nesne depolama yapılandırılmamış — AI görselleri kalıcı olmayabilir',
    },
    scheduler: {
      ready: schedulerReady,
      label: schedulerReady
        ? 'Zamanlayıcı aktif (STUDIO_SCHEDULER_ENABLED)'
        : 'Zamanlayıcı hazır değil — manuel yayın kullanın',
    },
    cms: {
      ok: cmsOk,
      label: cmsOk ? 'CMS DRAFT aktarımı hazır' : 'CMS tablosuna erişilemiyor',
    },
    languages,
    keywordData: {
      connected: false,
      label:     'Google Search Console bağlı değil — tüm kelime verileri "AI tahmini" olarak etiketlenir',
      providers: ['Google Search Console (bağlı değil)', 'Ahrefs (bağlı değil)', 'SEMrush (bağlı değil)'],
    },
    social: {
      newsletter: { connected: false, label: 'Bülten entegrasyonu yok — yalnızca taslak oluşturulur' },
      instagram:  { connected: false, label: 'Instagram API bağlı değil — yalnızca taslak' },
      facebook:   { connected: false, label: 'Facebook API bağlı değil — yalnızca taslak' },
      twitter:    { connected: false, label: 'Twitter/X API bağlı değil — yalnızca taslak' },
      linkedin:   { connected: false, label: 'LinkedIn API bağlı değil — yalnızca taslak' },
    },
    checkedAt: new Date().toISOString(),
  });
}
