/**
 * PATCH /admin/api/newsletter/[id] — Mark a subscriber as UNSUBSCRIBED (admin-only).
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let body: { status?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (body.status !== 'UNSUBSCRIBED') {
    return NextResponse.json({ error: 'Only UNSUBSCRIBED allowed' }, { status: 422 });
  }

  try {
    const { db } = await import('@/db');
    const { newsletterSubscribers, newsletterConsentEvents, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [sub] = await db.select({ normalizedEmail: newsletterSubscribers.normalizedEmail })
      .from(newsletterSubscribers).where(eq(newsletterSubscribers.id, id)).limit(1);

    if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.update(newsletterSubscribers)
      .set({ status: 'UNSUBSCRIBED', updatedAt: new Date() })
      .where(eq(newsletterSubscribers.id, id));

    await db.insert(newsletterConsentEvents).values({
      subscriberId:       id,
      normalizedEmail:    sub.normalizedEmail,
      action:             'WITHDRAWN',
      consentTextVersion: 'admin-unsubscribe',
      language:           'tr',
      source:             'admin-panel',
    });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId ?? null,
      action:      'UPDATE',
      entityType:  'newsletter_subscriber',
      entityId:    id,
      metadata:    { action: 'UNSUBSCRIBED' },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/newsletter/id] patch error:', (err as Error)?.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
