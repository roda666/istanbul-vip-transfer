/**
 * PATCH /admin/api/categories/[id] — rename, reorder, or activate/deactivate
 * DELETE /admin/api/categories/[id] — delete (only if no services assigned)
 */
import { NextRequest, NextResponse } from 'next/server';
import { invalidateServiceCategories } from '@/lib/service-category-server';
import { revalidatePublicServiceCatalog } from '@/lib/homepage-revalidation';

// ── PATCH ─────────────────────────────────────────────────────────────────────

const PRIVILEGED_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try { session = await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!PRIVILEGED_ROLES.includes(session.role))
    return NextResponse.json({ error: 'Forbidden — sadece ADMIN veya SUPER_ADMIN değiştirebilir.' }, { status: 403 });

  const { id } = await params;
  const catId  = parseInt(id, 10);
  if (isNaN(catId)) return NextResponse.json({ error: 'Geçersiz id.' }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const { action, names } = body as {
     action?: 'up' | 'down' | 'rename' | 'toggle-active';
    names?: Record<string, string>;
  };

  try {
    const { db }   = await import('@/db');
    const { serviceCategories, auditLogs } = await import('@/db/schema');
    const { eq, sql } = await import('drizzle-orm');

    // Fetch target category
    const [cat] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, catId)).limit(1);
    if (!cat) return NextResponse.json({ error: 'Kategori bulunamadı.' }, { status: 404 });

    if (action === 'up' || action === 'down') {
      // Find the adjacent category to swap sort_order with
      const allCats = await db
        .select({ id: serviceCategories.id, sortOrder: serviceCategories.sortOrder })
        .from(serviceCategories)
        .orderBy(serviceCategories.sortOrder);

      const idx = allCats.findIndex(c => c.id === catId);
      const swapIdx = action === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= allCats.length) {
        return NextResponse.json({ error: 'Daha fazla hareket ettirilemiyor.' }, { status: 400 });
      }

      const swapCat = allCats[swapIdx];
      // Swap sort_orders
      await db.execute(sql`
        UPDATE service_categories SET sort_order = CASE
          WHEN id = ${catId}      THEN ${swapCat.sortOrder}
          WHEN id = ${swapCat.id} THEN ${cat.sortOrder}
          ELSE sort_order
        END
        WHERE id IN (${catId}, ${swapCat.id})
      `);
    } else if (action === 'toggle-active') {
      // Publication/assignment and deactivation use the same transaction-scoped
      // advisory lock.  This makes the service count and category update one
      // atomic operation: a concurrent publish either commits first (and is
      // counted) or observes the category as inactive and is rejected.
      const toggleResult = await db.transaction(async (tx) => {
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(hashtext(${cat.slug}))
        `);

        // Also lock the row so a concurrent category update cannot leave us
        // toggling from a stale value read before acquiring the advisory lock.
        const [lockedCategory] = await tx
          .select({ isActive: serviceCategories.isActive })
          .from(serviceCategories)
          .where(eq(serviceCategories.id, catId))
          .for('update');
        if (!lockedCategory) return { count: 0, wasActive: false };

        if (lockedCategory.isActive) {
          const activeServices = await tx.execute(sql`
            SELECT COUNT(*)::int AS cnt FROM content
            WHERE content_type = 'SERVICE' AND category = ${cat.slug} AND is_active = true
          `);
          const count = Number((Array.from(activeServices)[0] as { cnt: number | string }).cnt ?? 0);
          if (count > 0) return { count, wasActive: true };
        }

        await tx.update(serviceCategories)
          .set({ isActive: !lockedCategory.isActive, updatedAt: new Date() })
          .where(eq(serviceCategories.id, catId));
        return { count: 0, wasActive: lockedCategory.isActive };
      });

      if (toggleResult.count > 0) {
        return NextResponse.json({
          error: `Bu kategori devre dışı bırakılamaz: ${toggleResult.count} aktif hizmet bağlı. Önce hizmetleri başka kategoriye taşıyın veya devre dışı bırakın.`,
        }, { status: 409 });
      }
    } else if (action === 'rename' && names) {
      const { fillMissingTranslations } = await import('@/lib/ai/fill-missing-translations');
      const currentNames = (cat.nameTranslations ?? {}) as Record<string, string>;
      const requestedNames = names as Record<string, string>;
      const sourceName = typeof requestedNames.tr === 'string' && requestedNames.tr.trim() ? requestedNames.tr.trim() : currentNames.tr;
      if (!sourceName) return NextResponse.json({ error: 'Türkçe kategori adı zorunludur.' }, { status: 422 });
      const existingByLocale = Object.fromEntries(
        Object.entries({ ...currentNames, ...requestedNames }).filter(([locale]) => locale !== 'tr').map(([locale, value]) => [locale, { name: value }]),
      );
      const translated = await fillMissingTranslations({ name: sourceName }, existingByLocale);
      const completedNames: Record<string, string> = { ...currentNames, ...requestedNames, tr: sourceName };
      for (const [locale, fields] of Object.entries(translated)) {
        if (!completedNames[locale] && fields.name) completedNames[locale] = fields.name;
      }
      await db
        .update(serviceCategories)
        .set({ nameTranslations: completedNames, updatedAt: new Date() })
        .where(eq(serviceCategories.id, catId));
    } else {
      return NextResponse.json({ error: 'Geçersiz action.' }, { status: 422 });
    }

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action:      'UPDATE',
      entityType:  'ServiceCategory',
      entityId:    String(catId),
    }).catch(() => {});

    invalidateServiceCategories();
    revalidatePublicServiceCatalog({ categorySlugs: [cat.slug] });

    // Return updated list
    const updated = await db.select().from(serviceCategories).orderBy(serviceCategories.sortOrder);
    return NextResponse.json({ categories: updated });
  } catch (err) {
    console.error('PATCH /admin/api/categories/[id] error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try { session = await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!PRIVILEGED_ROLES.includes(session.role))
    return NextResponse.json({ error: 'Forbidden — sadece ADMIN veya SUPER_ADMIN silebilir.' }, { status: 403 });

  const { id } = await params;
  const catId  = parseInt(id, 10);
  if (isNaN(catId)) return NextResponse.json({ error: 'Geçersiz id.' }, { status: 400 });

  try {
    const { db }   = await import('@/db');
    const { serviceCategories, auditLogs } = await import('@/db/schema');
    const { eq, sql } = await import('drizzle-orm');

    const [cat] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, catId)).limit(1);
    if (!cat) return NextResponse.json({ error: 'Kategori bulunamadı.' }, { status: 404 });

    // Check if any services are assigned to this category
    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM content
      WHERE content_type = 'SERVICE' AND category = ${cat.slug}
    `);
    const cnt = (Array.from(countResult)[0] as { cnt: number }).cnt ?? 0;
    if (cnt > 0) {
      return NextResponse.json({
        error: `Bu kategoride ${cnt} hizmet var. Önce hizmetleri başka bir kategoriye taşıyın.`,
      }, { status: 409 });
    }

    await db.delete(serviceCategories).where(eq(serviceCategories.id, catId));

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action:      'DELETE',
      entityType:  'ServiceCategory',
      entityId:    String(catId),
    }).catch(() => {});

    invalidateServiceCategories();
    revalidatePublicServiceCatalog({ categorySlugs: [cat.slug] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /admin/api/categories/[id] error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
