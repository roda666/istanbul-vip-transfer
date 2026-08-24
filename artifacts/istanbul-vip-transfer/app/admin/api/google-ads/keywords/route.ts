/**
 * Exact Keyword Planner metrics for administrator-provided Turkish keywords.
 * Results are emitted only when Google returns a same-text idea; we never
 * substitute an adjacent idea's volume or infer a value.
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  keywords: z.array(z.string().trim().min(2).max(120)).min(1, 'En az bir anahtar kelime girin.').max(10, 'Bir seferde en fazla 10 anahtar kelime sorgulanabilir.'),
});
const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');

export async function GET() {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { getGoogleAdsStatus } = await import('@/lib/google-ads');
  const status = await getGoogleAdsStatus();
  return NextResponse.json({
    provider: 'google_ads_keyword_planner',
    market: { country: 'TR', language: 'tr', label: 'Türkiye / Türkçe' },
    ...status,
  });
}

export async function POST(request: NextRequest) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });

  const { getGoogleAdsStatus, generateKeywordIdeas } = await import('@/lib/google-ads');
  const status = await getGoogleAdsStatus();
  if (!status.ready) {
    return NextResponse.json({
      error: `Anahtar kelime hacmi sorgulanamıyor: ${status.label}`,
      reason: 'provider_unavailable',
      provider: 'google_ads_keyword_planner',
      status,
    }, { status: 503 });
  }
  const keywords = [...new Set(parsed.data.keywords.map(value => value.trim().replace(/\s+/g, ' ')))];
  try {
    const ideas = await generateKeywordIdeas(keywords, 100, true);
    const byText = new Map(ideas.map(item => [normalized(item.text), item]));
    const rows = keywords.map(keyword => {
      const metric = byText.get(normalized(keyword));
      if (!metric) return {
        keyword, state: 'no_exact_metric' as const,
        message: 'Keyword Planner bu ifadenin tam eşleşen metriğini döndürmedi; metrik gösterilmiyor.',
      };
      return {
        keyword, state: 'available' as const,
        avgMonthlySearches: metric.avgMonthlySearches,
        competition: metric.competition,
        provenance: {
          provider: 'Google Ads Keyword Planner',
          market: 'Türkiye / Türkçe',
          retrievedAt: new Date().toISOString(),
          match: 'exact_returned_keyword',
        },
      };
    });
    return NextResponse.json({
      provider: 'google_ads_keyword_planner',
      market: { country: 'TR', language: 'tr', label: 'Türkiye / Türkçe' },
      rows,
    });
  } catch {
    return NextResponse.json({
      error: 'Google Ads Keyword Planner şu anda yanıt vermiyor. Metrik üretilmedi; bağlantıyı kontrol edip tekrar deneyin.',
      reason: 'provider_unavailable',
      provider: 'google_ads_keyword_planner',
    }, { status: 503 });
  }
}