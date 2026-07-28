/**
 * GET  /admin/api/languages  — list all languages
 * POST /admin/api/languages  — create a new language
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';

const createSchema = z.object({
  code: z.string().min(2).max(10).regex(/^[a-z]{2,3}(-[A-Z]{2})?$/),
  locale: z.string().min(2).max(20),
  name: z.string().min(1).max(100),
  nativeName: z.string().min(1).max(100),
  direction: z.enum(['ltr', 'rtl']).default('ltr'),
  isEnabled: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/db');
  const { languages } = await import('@/db/schema');
  const { asc } = await import('drizzle-orm');

  try {
    const rows = await db.select().from(languages).orderBy(asc(languages.displayOrder));
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { languages, auditLogs } = await import('@/db/schema');

  try {
    const [lang] = await db.insert(languages).values({
      ...parsed.data,
      isDefault: false,
      createdBy: session.adminId,
      updatedBy: session.adminId,
    }).returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'language.create',
      entityType: 'language',
      entityId: lang.id,
      metadata: { code: lang.code, name: lang.name },
    });

    return NextResponse.json({ item: lang }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Language code already exists' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
