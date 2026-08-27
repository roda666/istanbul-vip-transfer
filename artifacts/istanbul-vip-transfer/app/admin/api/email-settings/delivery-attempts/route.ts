import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';

/** Recent SMTP evidence for the E-posta Ayarları panel. */
export async function GET() {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
  }
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  }

  try {
    const { db } = await import('@/db');
    const { emailDeliveryAttempts } = await import('@/db/schema');
    const attempts = await db.select({
      id: emailDeliveryAttempts.id,
      occurredAt: emailDeliveryAttempts.occurredAt,
      recipient: emailDeliveryAttempts.recipient,
      source: emailDeliveryAttempts.source,
      requestReference: emailDeliveryAttempts.requestReference,
      resultCode: emailDeliveryAttempts.resultCode,
      accepted: emailDeliveryAttempts.accepted,
      acceptedCount: emailDeliveryAttempts.acceptedCount,
      rejectedCount: emailDeliveryAttempts.rejectedCount,
      smtpResponseCode: emailDeliveryAttempts.smtpResponseCode,
      serverResponse: emailDeliveryAttempts.serverResponse,
      messageId: emailDeliveryAttempts.messageId,
      linkOriginMode: emailDeliveryAttempts.linkOriginMode,
      previewDomainUsed: emailDeliveryAttempts.previewDomainUsed,
    }).from(emailDeliveryAttempts)
      .orderBy(desc(emailDeliveryAttempts.occurredAt))
      .limit(20);

    return NextResponse.json({ attempts });
  } catch {
    return NextResponse.json({ error: 'E-posta teslimat geçmişi yüklenemedi.' }, { status: 500 });
  }
}