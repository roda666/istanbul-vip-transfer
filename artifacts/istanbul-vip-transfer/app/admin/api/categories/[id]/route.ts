/**
 * PATCH /admin/api/categories/[id] — rename, reorder, or activate/deactivate
 * DELETE /admin/api/categories/[id] — delete (only if no services assigned)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { invalidateServiceCategories } from '@/lib/service-category-server';
import { revalidatePublicServiceCatalog } from '@/lib/homepage-revalidation';
import {
  computeCustomerContentSourceHash,
  enqueueCustomerContentTranslations,
} from '@/lib/customer-content-translation';

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
      // Swap both values in one transaction so concurrent reorder requests cannot
      // leave duplicate or partially updated positions.
      await db.transaction(async (tx) => {
        const allCats = await tx.select({
          id: serviceCategories.id, sortOrder: serviceCategories.sortOrder,
        }).from(serviceCategories).orderBy(serviceCategories.sortOrder).for('update');
        const idx = allCats.findIndex(c => c.id === catId);
        const swapIdx = action === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= allCats.length) throw new Error('Daha fazla hareket ettirilemiyor.');
        const swapCat = allCats[swapIdx];
        const locked = await tx.select({
          id: serviceCategories.id,
          sortOrder: serviceCategories.sortOrder,
        }).from(serviceCategories).where(sql`id IN (${catId}, ${swapCat.id})`).for('update');
        const target = locked.find((item) => item.id === catId);
        const peer = locked.find((item) => item.id === swapCat.id);
        if (!target || !peer) throw new Error('Kategori sırası değiştirilemedi.');
        await tx.update(serviceCategories).set({ sortOrder: peer.sortOrder, updatedAt: new Date() }).where(sql`id = ${catId}`);
        await tx.update(serviceCategories).set({ sortOrder: target.sortOrder, updatedAt: new Date() }).where(sql`id = ${swapCat.id}`);
      });
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
      const currentNames = (cat.nameTranslations ?? {}) as Record<string, string>;
      const requestedNames = names as Record<string, string>;
      const sourceName = typeof requestedNames.tr === 'string' && requestedNames.tr.trim() ? requestedNames.tr.trim() : currentNames.tr;
      if (!sourceName) return NextResponse.json({ error: 'Türkçe kategori adı zorunludur.' }, { status: 422 });
      const completedNames: Record<string, string> = { ...currentNames, ...requestedNames, tr: sourceName };
      await db
        .update(serviceCategories)
        .set({ nameTranslations: completedNames, updatedAt: new Date() })
        .where(eq(serviceCategories.id, catId));
      await enqueueCustomerContentTranslations({
        entityType: 'category',
        entityId: String(catId),
        sourceHash: computeCustomerContentSourceHash({ slug: cat.slug, name: sourceName }),
        sourceAdapterId: String(catId),
        adminId: session.adminId,
      });
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
    if (err instanceof Error && err.message === 'Daha fazla hareket ettirilemiyor.')
      return NextResponse.json({ error: err.message }, { status: 400 });
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
  if (!session.capabilities.content.canManage || !PRIVILEGED_ROLES.includes(session.role))
    return NextResponse.json({ error: 'Bu kategori için yönetim yetkisi gerekli.' }, { status: 403 });

  const { id } = await params;
  const catId  = parseInt(id, 10);
  if (isNaN(catId)) return NextResponse.json({ error: 'Geçersiz id.' }, { status: 400 });

  try {
    const { db }   = await import('@/db');
    const { serviceCategories, contentTranslations, auditLogs } = await import('@/db/schema');
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

    await db.transaction(async tx => {
      const digest = createHash('sha1').update(`customer-category:${catId}`).digest('hex');
      const categoryEntityId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
      await tx.delete(contentTranslations).where(eq(contentTranslations.entityId, categoryEntityId));
      await tx.delete(serviceCategories).where(eq(serviceCategories.id, catId));
      await tx.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: 'DELETE',
        entityType: 'ServiceCategory',
        entityId: String(catId),
      });
    });

    invalidateServiceCategories();
    revalidatePublicServiceCatalog({ categorySlugs: [cat.slug] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /admin/api/categories/[id] error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
