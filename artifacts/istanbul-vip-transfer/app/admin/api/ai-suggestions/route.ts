import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const suggestionSchema = z.object({
  suggestedTitle: z.string().max(300).optional().nullable(),
  primaryKeyword: z.string().max(200).optional().nullable(),
  secondaryKeywords: z.string().max(500).optional().nullable(),
  searchIntent: z.string().max(100).optional().nullable(),
  articleType: z.string().max(100).optional().nullable(),
  targetService: z.string().max(100).optional().nullable(),
  targetLocation: z.string().max(100).optional().nullable(),
});

export async function GET() {
  try { await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  try {
    const { db } = await import('@/db');
    const { aiContentSuggestions } = await import('@/db/schema');
    const { desc } = await import('drizzle-orm');

    const rows = await db.select().from(aiContentSuggestions).orderBy(desc(aiContentSuggestions.createdAt));
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error('AI suggestions list error:', err);
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

  const parsed = suggestionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });

  try {
    const { db } = await import('@/db');
    const { aiContentSuggestions, auditLogs } = await import('@/db/schema');

    const [newItem] = await db
      .insert(aiContentSuggestions)
      .values({ ...parsed.data, status: 'PENDING' })
      .returning();

    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'CREATE', entityType: 'AISuggestion', entityId: newItem.id }).catch(() => {});
    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (err) {
    console.error('AI suggestion create error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
