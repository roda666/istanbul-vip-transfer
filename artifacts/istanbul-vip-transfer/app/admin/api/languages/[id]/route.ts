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
  turkishName: z.string().min(1).max(100).optional(),
  locale: z.string().min(2).max(20).optional(),
  direction: z.enum(['ltr', 'rtl']).optional(),
  isEnabled: z.boolean().optional(),
  isPublished: z.boolean().optional(),
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

    // ── Server-side guards ─────────────────────────────────────────────────
    // Turkish is the source language: it can never be disabled, unpublished,
    // or stripped of its default status.
    if (existing.code === 'tr') {
      if (parsed.data.isEnabled === false || parsed.data.isPublished === false || parsed.data.isDefault === false) {
        return NextResponse.json(
          { error: 'Türkçe kaynak dildir — devre dışı bırakılamaz veya yayından kaldırılamaz.' },
          { status: 400 },
        );
      }
    }
    // Turkish is the immutable sole default: no other language may become
    // default, so `isDefault: true` is rejected for any non-TR row.
    if (parsed.data.isDefault === true && existing.code !== 'tr') {
      return NextResponse.json(
        { error: 'Varsayılan dil değiştirilemez — Türkçe her zaman kaynak ve varsayılan dildir.' },
        { status: 400 },
      );
    }
    // Provider-unsupported languages cannot be enabled or published.
    if (!existing.providerSupported && (parsed.data.isEnabled === true || parsed.data.isPublished === true)) {
      return NextResponse.json(
        { error: 'Çeviri sağlayıcısı bu dili desteklemiyor — etkinleştirilemez veya yayınlanamaz.' },
        { status: 400 },
      );
    }
    // A language can only be published if the public site can render it —
    // i.e. its static UI dictionary exists. Others may be enabled for draft
    // translation preparation, but never exposed publicly.
    if (parsed.data.isPublished === true) {
      const { RENDERABLE_LANGS } = await import('@/lib/i18n/active-locales');
      if (!RENDERABLE_LANGS.includes(existing.code)) {
        return NextResponse.json(
          { error: 'Bu dilin site arayüzü sözlüğü henüz hazır değil — yayınlanamaz. Dili etkinleştirip çeviri taslakları hazırlayabilirsiniz; kamuya açma sözlük eklendiğinde mümkün olur.' },
          { status: 400 },
        );
      }
    }
    // A language must be enabled before it can be published.
    if (parsed.data.isPublished === true && !(parsed.data.isEnabled ?? existing.isEnabled)) {
      return NextResponse.json(
        { error: 'Dil yayınlanmadan önce etkinleştirilmelidir.' },
        { status: 400 },
      );
    }
    // Disabling also unpublishes (never leave a published-but-disabled state).
    if (parsed.data.isEnabled === false) {
      parsed.data.isPublished = false;
    }

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

    // Public locale set may have changed — drop the 60s cache immediately.
    const { invalidatePublicLanguagesCache } = await import('@/lib/i18n/active-locales');
    invalidatePublicLanguagesCache();

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
