import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const faqSchema = z.object({
  question: z.string().min(1, 'Soru gereklidir').max(500),
  answer: z.string().min(1, 'Cevap gereklidir'),
  sortOrder: z.number().int().min(0).default(0),
  contentId: z.string().uuid('Geçerli bir içerik ID giriniz'),
});

export async function GET(request: NextRequest) {
  try { await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { searchParams } = request.nextUrl;
  const contentId = searchParams.get('contentId');

  try {
    const { db } = await import('@/db');
    const { faqs, content } = await import('@/db/schema');
    const { eq, asc } = await import('drizzle-orm');

    const rows = await db
      .select({ id: faqs.id, question: faqs.question, answer: faqs.answer, sortOrder: faqs.sortOrder, contentId: faqs.contentId, contentTitle: content.title })
      .from(faqs).leftJoin(content, eq(faqs.contentId, content.id))
      .where(contentId ? eq(faqs.contentId, contentId) : undefined)
      .orderBy(asc(faqs.sortOrder));

    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error('FAQs list error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let session;
  try { session = await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const parsed = faqSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });

  try {
    const { db } = await import('@/db');
    const { faqs, auditLogs } = await import('@/db/schema');
    const [newFaq] = await db.insert(faqs).values(parsed.data).returning();
    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'CREATE', entityType: 'FAQ', entityId: newFaq.id }).catch(() => {});
    return NextResponse.json({ item: newFaq }, { status: 201 });
  } catch (err) {
    console.error('FAQ create error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
