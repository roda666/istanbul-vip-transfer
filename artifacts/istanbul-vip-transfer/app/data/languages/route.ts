/**
 * GET /data/languages — public list of active + published site languages.
 *
 * Used by the client-side LanguageSelector so the selector reflects the DB
 * language configuration (single source of truth). Passive catalog languages
 * are never returned here.
 */
import { NextResponse } from 'next/server';
import { getPublicLanguages } from '@/lib/i18n/active-locales';

export const dynamic = 'force-dynamic';

export async function GET() {
  const langs = await getPublicLanguages();
  return NextResponse.json(
    { items: langs },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
