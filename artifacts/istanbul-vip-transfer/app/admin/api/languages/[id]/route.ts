/**
 * PATCH /admin/api/languages/[id] — update a language (enable/disable, name, direction, order)
 * DELETE /admin/api/languages/[id] — remove a non-default language
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { eq, ne } from 'drizzle-orm';

const patchSchema = z.object({
  nativeName: z.string().min(1).max(100).optional(),
  locale: z.string().min(2).max(20).optional(),
  direction: z.enum(['ltr', 'rtl']).optional(),
  isEnabled: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { languages, auditLogs } = await import('@/db/schema');
  const { sql } = await import('drizzle-orm');

  try {
    const [existing] = await db.select().from(languages).where(eq(languages.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // If setting as default, clear other defaults first
    if (parsed.data.isDefault) {
      await db.update(languages).set({ isDefault: false }).where(ne(languages.id, id));
    }

    const [updated] = await db
      .update(languages)
      .set({ ...parsed.data, updatedAt: sql`now()`, updatedBy: session.adminId })
      .where(eq(languages.id, id))
      .returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'language.update',
      entityType: 'language',
      entityId: id,
      metadata: { changes: parsed.data, code: existing.code },
    });

    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { db } = await import('@/db');
  const { languages, auditLogs } = await import('@/db/schema');

  try {
    const [existing] = await db.select().from(languages).where(eq(languages.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.isDefault) {
      return NextResponse.json({ error: 'Cannot delete the default language' }, { status: 400 });
    }
    if (existing.code === 'tr') {
      return NextResponse.json({ error: 'Cannot delete Turkish — it is the source language' }, { status: 400 });
    }

    await db.delete(languages).where(eq(languages.id, id));

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'language.delete',
      entityType: 'language',
      entityId: id,
      metadata: { code: existing.code, name: existing.name },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
