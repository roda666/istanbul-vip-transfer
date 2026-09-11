import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, optionalServices } from '@/db/schema';

type Params = { params: Promise<{ id: string }> };

/** Atomically swaps an active service with its adjacent non-archived peer. */
export async function POST(request: NextRequest, { params }: Params) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const direction = (body as { direction?: unknown })?.direction;
  if (direction !== 'up' && direction !== 'down') return NextResponse.json({ error: 'Yön up veya down olmalıdır.' }, { status: 422 });
  const { id } = await params;
  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(optionalServices)
        .where(and(eq(optionalServices.id, id), isNull(optionalServices.archivedAt))).limit(1);
      if (!current) return { error: 'Hizmet bulunamadı.', status: 404 as const };
      const visible = await tx.select().from(optionalServices)
        .where(isNull(optionalServices.archivedAt))
        .orderBy(asc(optionalServices.displayOrder), asc(optionalServices.name));
      const position = visible.findIndex((item) => item.id === current.id);
      const peer = visible[position + (direction === 'up' ? -1 : 1)];
      if (!peer) return { item: current, moved: false };
      await tx.update(optionalServices).set({ displayOrder: peer.displayOrder, updatedAt: new Date(), updatedBy: session.adminId }).where(eq(optionalServices.id, current.id));
      await tx.update(optionalServices).set({ displayOrder: current.displayOrder, updatedAt: new Date(), updatedBy: session.adminId }).where(eq(optionalServices.id, peer.id));
      await tx.insert(auditLogs).values({ adminUserId: session.adminId, action: 'UPDATE', entityType: 'OptionalService', entityId: id, metadata: { action: 'REORDER', direction, peerId: peer.id } }).catch(() => {});
      return { moved: true };
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Optional service reorder error:', error);
    return NextResponse.json({ error: 'Sıralama güncellenemedi.' }, { status: 503 });
  }
}