import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
const schema = z.object({ name: z.string().trim().min(1).max(200).optional(), phone: z.string().trim().max(60).nullable().optional(), notes: z.string().trim().max(2000).nullable().optional(), isActive: z.boolean().optional() });
async function auth() { try { return await (await import('@/lib/auth/session')).requireAdminSession(); } catch { return null; } }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await auth(); if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Geçersiz sürücü.' }, { status: 422 });
  try {
    const { db } = await import('@/db'); const { drivers, auditLogs } = await import('@/db/schema'); const { eq } = await import('drizzle-orm');
    const id = (await params).id; const [item] = await db.update(drivers).set({ ...parsed.data, updatedAt: new Date(), updatedBy: admin.adminId }).where(eq(drivers.id, id)).returning();
    if (!item) return NextResponse.json({ error: 'Sürücü bulunamadı.' }, { status: 404 });
    await db.insert(auditLogs).values({ adminUserId: admin.adminId, action: 'UPDATE', entityType: 'driver', entityId: id, metadata: parsed.data });
    return NextResponse.json({ item });
  } catch { return NextResponse.json({ error: 'Sürücü güncellenemedi.' }, { status: 503 }); }
}