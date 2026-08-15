/**
 * GET /admin/api/studio/slugs/check?slug=some-slug
 * Check if a slug conflicts with existing published/draft pages.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug parametresi gerekli.' }, { status: 400 });

  const { checkSlugConflict } = await import('@/lib/studio/export-to-cms');
  const result = await checkSlugConflict(slug);

  return NextResponse.json(result);
}
