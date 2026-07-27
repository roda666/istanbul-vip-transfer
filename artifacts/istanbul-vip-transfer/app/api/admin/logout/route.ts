import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const { getSession } = await import('@/lib/auth/session');
    const { db } = await import('@/db');
    const { auditLogs } = await import('@/db/schema');

    const session = await getSession();
    const adminId = session.adminId;

    // Destroy session
    session.destroy();

    // Audit log (best-effort)
    if (adminId) {
      await db
        .insert(auditLogs)
        .values({ adminUserId: adminId, action: 'LOGOUT', entityType: 'AdminUser', entityId: adminId })
        .catch(() => {});
    }
  } catch {
    // Even if something fails, clear the cookie response
  }

  return NextResponse.json({ success: true });
}
