import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
const schema = z.object({ name: z.string().trim().min(1).max(200).optional(), phone: z.string().trim().max(60).nullable().optional(), notes: z.string().trim().max(2000).nullable().optional(), isActive: z.boolean().optional(), action: z.enum(['reorder']).optional(), direction: z.enum(['up', 'down']).optional() });
async function auth() { try { return await (await import('@/lib/auth/session')).requireAdminSession(); } catch { return null; } }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await auth(); if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Geçersiz sürücü.' }, { status: 422 });
  try {
    const { db } = await import('@/db'); const { drivers, auditLogs } = await import('@/db/schema'); const { asc, eq } = await import('drizzle-orm');
    const id = (await params).id;
    if (parsed.data.action === 'reorder') {
      if (!parsed.data.direction) return NextResponse.json({ error: 'Yön belirtilmelidir.' }, { status: 422 });
      const ordered = await db.transaction(async (tx) => {
        const rows = await tx.select().from(drivers).orderBy(asc(drivers.displayOrder), asc(drivers.id)).for('update');
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0) return null;
        // Normalize the locked rows before moving anything.  Swap their array
        // positions, then assign order from the final positions; assigning
        // before the swap would make the subsequent sort undo the move.
        const normalized = rows.map((row) => ({ ...row }));
        const target = parsed.data.direction === 'up' ? index - 1 : index + 1;
        if (target >= 0 && target < normalized.length) {
          [normalized[index], normalized[target]] = [normalized[target], normalized[index]];
        }
        const resequenced = normalized.map((row, displayOrder) => ({ ...row, displayOrder }));
        for (const row of resequenced) {
          await tx.update(drivers).set({ displayOrder: row.displayOrder, updatedAt: new Date(), updatedBy: admin.adminId }).where(eq(drivers.id, row.id));
        }
        await tx.insert(auditLogs).values({ adminUserId: admin.adminId, action: 'REORDER', entityType: 'driver', entityId: id, metadata: { direction: parsed.data.direction } });
        return resequenced;
      });
      if (!ordered) return NextResponse.json({ error: 'Sürücü bulunamadı.' }, { status: 404 });
      return NextResponse.json({ items: ordered });
    }
    const [item] = await db.update(drivers).set({ name: parsed.data.name, phone: parsed.data.phone, notes: parsed.data.notes, isActive: parsed.data.isActive, updatedAt: new Date(), updatedBy: admin.adminId }).where(eq(drivers.id, id)).returning();
    if (!item) return NextResponse.json({ error: 'Sürücü bulunamadı.' }, { status: 404 });
    await db.insert(auditLogs).values({ adminUserId: admin.adminId, action: 'UPDATE', entityType: 'driver', entityId: id, metadata: parsed.data });
    return NextResponse.json({ item });
  } catch { return NextResponse.json({ error: 'Sürücü güncellenemedi.' }, { status: 503 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await auth(); if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { db } = await import('@/db'); const { drivers, transferOperations, transferAssignmentAudits, auditLogs } = await import('@/db/schema'); const { eq, or } = await import('drizzle-orm');
    const id = (await params).id;
    const [item] = await db.select().from(drivers).where(eq(drivers.id, id));
    if (!item) return NextResponse.json({ error: 'Sürücü bulunamadı.' }, { status: 404 });
    const references = await db.select({ id: transferOperations.id }).from(transferOperations).where(eq(transferOperations.driverId, id));
    const auditReferences = await db.select({ id: transferAssignmentAudits.id }).from(transferAssignmentAudits).where(or(eq(transferAssignmentAudits.driverId, id), eq(transferAssignmentAudits.previousDriverId, id))).limit(1);
    if (references.length || auditReferences.length) return NextResponse.json({ error: 'Bu sürücü transfer operasyonlarında kullanılıyor; silmek yerine devre dışı bırakın.' }, { status: 409 });
    await db.transaction(async (tx) => {
      await tx.delete(drivers).where(eq(drivers.id, id));
      await tx.insert(auditLogs).values({ adminUserId: admin.adminId, action: 'DELETE', entityType: 'driver', entityId: id, metadata: {} });
    });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Sürücü silinemedi.' }, { status: 503 }); }
}