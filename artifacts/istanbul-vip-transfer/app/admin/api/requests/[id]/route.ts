/**
 * PATCH /admin/api/requests/[id] — Update status, notes, or archive a reservation request.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = [
  'NEW', 'CONTACTED', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'SPAM', 'ARCHIVED',
] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: { status?: string; archive?: boolean; notes?: string; isTestData?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const { db } = await import('@/db');
    const { reservationRequests, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    if (typeof body.isTestData === 'boolean') {
      await db.update(reservationRequests)
        .set({ isTestData: body.isTestData, updatedAt: new Date() })
        .where(eq(reservationRequests.id, id));

      await db.insert(auditLogs).values({
        adminUserId: session.adminId ?? null,
        action:      body.isTestData ? 'MARK_TEST_DATA' : 'UNMARK_TEST_DATA',
        entityType:  'reservation_request',
        entityId:    id,
        metadata:    {},
      });

      return NextResponse.json({ ok: true });
    }

    if (body.archive) {
      await db.update(reservationRequests)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(reservationRequests.id, id));

      await db.insert(auditLogs).values({
        adminUserId: session.adminId ?? null,
        action:      'ARCHIVE',
        entityType:  'reservation_request',
        entityId:    id,
        metadata:    {},
      });

      return NextResponse.json({ ok: true });
    }

    // Update notes — can be combined with status or standalone
    if (typeof body.notes === 'string') {
      const trimmed = body.notes.trim().slice(0, 4000);
      await db.update(reservationRequests)
        .set({ adminNotes: trimmed || null, updatedAt: new Date() })
        .where(eq(reservationRequests.id, id));

      await db.insert(auditLogs).values({
        adminUserId: session.adminId ?? null,
        action:      'UPDATE_NOTES',
        entityType:  'reservation_request',
        entityId:    id,
        metadata:    {},
      });

      // If only notes update, return early unless status also provided
      if (!body.status) return NextResponse.json({ ok: true });
    }

    if (body.status) {
      if (!(VALID_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 422 });
      }

      const [before] = await db
        .select({ status: reservationRequests.status })
        .from(reservationRequests)
        .where(eq(reservationRequests.id, id))
        .limit(1);

      await db.update(reservationRequests)
        .set({ status: body.status as never, updatedAt: new Date() })
        .where(eq(reservationRequests.id, id));

      await db.insert(auditLogs).values({
        adminUserId: session.adminId ?? null,
        action:      'UPDATE',
        entityType:  'reservation_request',
        entityId:    id,
        metadata:    { from: before?.status, to: body.status },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Nothing to update' }, { status: 422 });
  } catch (err) {
    console.error('[admin/requests/id] patch error:', (err as Error)?.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
