/**
 * PATCH /admin/api/categories/[id] — rename or reorder a category
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
    action?: 'up' | 'down' | 'rename';
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
    } else if (action === 'rename' && names) {
      await db
        .update(serviceCategories)
        .set({ nameTranslations: names, updatedAt: new Date() })
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
