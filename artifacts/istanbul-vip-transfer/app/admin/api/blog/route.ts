/**
 * POST /admin/api/blog — Create a new BLOG_POST
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

const createSchema = z.object({
  title:  z.string().min(1).max(300),
  slug:   z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  status: z.enum(['IDEA','DRAFT']).default('IDEA'),
});

export async function POST(req: NextRequest) {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }

  const { title, status } = parsed.data;
  const slug = parsed.data.slug ?? slugify(title);

  try {
    const { db }      = await import('@/db');
    const { content } = await import('@/db/schema');
    const now = new Date();

    const [inserted] = await db.insert(content).values({
      contentType:    'BLOG_POST',
      title,
      slug,
      status,
      indexable:      true,
      isActive:       true,
      displayOrder:   0,
      showOnHomepage: false,
      showInNav:      false,
      createdAt:      now,
      updatedAt:      now,
    } as never).returning({ id: content.id });

    return NextResponse.json({ id: inserted?.id }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique')) {
      return NextResponse.json({ error: `"${slug}" slug\'u zaten kullanımda.` }, { status: 409 });
    }
    return NextResponse.json({ error: 'DB hatası.' }, { status: 503 });
  }
}
