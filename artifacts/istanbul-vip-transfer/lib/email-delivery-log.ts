import 'server-only';

export type EmailDeliveryLogInput = {
  recipient: string;
  source?: string;
  requestReference?: string;
  adminUserId?: string;
  resultCode: string;
  accepted: boolean;
  acceptedCount: number;
  rejectedCount: number;
  smtpResponseCode?: number;
  serverResponse: string;
  messageId?: string;
};

/**
 * Persist provider evidence separately from request content and credentials.
 * A delivery result remains truthful even if this secondary write is
 * unavailable; the caller can surface that fact through monitoring.
 */
export async function persistEmailDeliveryAttempt(input: EmailDeliveryLogInput): Promise<boolean> {
  try {
    const { db } = await import('@/db');
    const { emailDeliveryAttempts } = await import('@/db/schema');

    await db.insert(emailDeliveryAttempts).values({
      recipient: input.recipient.trim().toLowerCase().slice(0, 320),
      source: (input.source?.trim() || 'SYSTEM').slice(0, 80),
      requestReference: input.requestReference?.trim().slice(0, 120) || null,
      adminUserId: input.adminUserId || null,
      resultCode: input.resultCode.slice(0, 80),
      accepted: input.accepted,
      acceptedCount: input.acceptedCount,
      rejectedCount: input.rejectedCount,
      smtpResponseCode: input.smtpResponseCode ?? null,
      serverResponse: input.serverResponse.slice(0, 1000),
      messageId: input.messageId?.slice(0, 500) || null,
    });
    return true;
  } catch {
    return false;
  }
}