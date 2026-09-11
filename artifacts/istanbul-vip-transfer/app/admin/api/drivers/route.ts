import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const schema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(60).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

async function session() {
  try { return await (await import('@/lib/auth/session')).requireAdminSession(); } catch { return null; }
}

export async function GET() {
  if (!await session()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { db } = await import('@/db');
    const { drivers } = await import('@/db/schema');
    const { asc } = await import('drizzle-orm');
    return NextResponse.json({ items: await db.select().from(drivers).orderBy(asc(drivers.name)) });
  } catch { return NextResponse.json({ error: 'Sürücüler yüklenemedi.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const admin = await session();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz sürücü.' }, { status: 422 });
  try {
    const { db } = await import('@/db');
    const { drivers, auditLogs } = await import('@/db/schema');
    const [item] = await db.insert(drivers).values({ ...parsed.data, createdBy: admin.adminId, updatedBy: admin.adminId }).returning();
    await db.insert(auditLogs).values({ adminUserId: admin.adminId, action: 'CREATE', entityType: 'driver', entityId: item.id, metadata: {} });
    return NextResponse.json({ item }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Sürücü oluşturulamadı.' }, { status: 503 }); }
}