/**
 * Admin-managed competitor domains. These records are configuration only:
 * adding a domain never implies that its pages have been fetched or analysed.
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const roles = ['SUPER_ADMIN', 'ADMIN', 'EDITOR'];

function normalizeDomain(value: string): string | null {
  const raw = value.trim().toLowerCase();
  const candidate = raw.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!candidate || candidate.includes('/') || candidate.includes('@') || candidate.includes(':')) return null;
  try {
    const url = new URL(`https://${candidate}`);
    return url.hostname === candidate && url.hostname.includes('.') ? candidate : null;
  } catch {
    return null;
  }
}

const inputSchema = z.object({
  domain: z.string().min(1, 'Rakip alan adı zorunludur.').max(253),
  label: z.string().trim().min(1, 'Görünen ad zorunludur.').max(120),
  notes: z.string().trim().max(2_000).nullable().optional(),
  active: z.boolean().optional().default(true),
});

async function authorize(write = false) {
  const session = await requireAdminSession();
  if (!roles.includes(session.role) || (write && !['SUPER_ADMIN', 'ADMIN'].includes(session.role))) {
    throw new Error('forbidden');
  }
  return session;
}

export async function GET() {
  try { await authorize(); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'forbidden' ? 'Forbidden' : 'Unauthorized' }, { status: error instanceof Error && error.message === 'forbidden' ? 403 : 401 });
  }
  try {
    const { db } = await import('@/db');
    const { competitorSites } = await import('@/db/schema');
    const { asc } = await import('drizzle-orm');
    const items = await db.select().from(competitorSites).orderBy(asc(competitorSites.label));
    return NextResponse.json({
      items,
      analysisState: 'unavailable',
      analysisLabel: 'Rakip konu analizi için yapılandırılmış bir tarama/veri kaynağı yok. Listelenen alan adları henüz analiz edilmiş değildir.',
    });
  } catch {
    return NextResponse.json({ error: 'Rakip siteler okunamadı. Lütfen tekrar deneyin.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let session;
  try { session = await authorize(true); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'forbidden' ? 'Bu işlem için ADMIN veya SUPER_ADMIN yetkisi gerekir.' : 'Unauthorized' }, { status: error instanceof Error && error.message === 'forbidden' ? 403 : 401 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  const domain = normalizeDomain(parsed.data.domain);
  if (!domain) return NextResponse.json({ error: 'Geçerli bir alan adı girin (ör. example.com). URL yolu veya giriş bilgisi kabul edilmez.' }, { status: 422 });

  try {
    const { db } = await import('@/db');
    const { competitorSites, auditLogs } = await import('@/db/schema');
    const { sanitizeText } = await import('@/lib/sanitize');
    const [item] = await db.insert(competitorSites).values({
      domain, label: sanitizeText(parsed.data.label), notes: parsed.data.notes ? sanitizeText(parsed.data.notes) : null, active: parsed.data.active,
    }).returning();
    await db.insert(auditLogs).values({
      adminUserId: session.adminId, action: 'CREATE', entityType: 'CompetitorSite', entityId: String(item.id),
      metadata: { domain: item.domain, active: item.active },
    }).catch(() => {});
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (String(error).toLowerCase().includes('unique') || String(error).toLowerCase().includes('duplicate')) {
      return NextResponse.json({ error: 'Bu alan adı zaten rakip listesinde bulunuyor.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Rakip sitesi kaydedilemedi. Lütfen tekrar deneyin.' }, { status: 503 });
  }
}