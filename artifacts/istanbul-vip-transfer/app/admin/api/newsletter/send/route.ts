/** POST /admin/api/newsletter/send — send a composed message only to ACTIVE subscribers. */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';
import { createUnsubscribeUrl } from '@/lib/newsletter';
import { sendEmailDetailed } from '@/lib/email';
import { resolveEmailLinkOrigin } from '@/lib/email-link-url';

export const dynamic = 'force-dynamic';
const Body = z.object({ subject: z.string().min(2).max(200), html: z.string().min(1).max(100_000), text: z.string().max(100_000).optional() });

export async function POST(req: NextRequest) {
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz konu veya mesaj.' }, { status: 422 });
  const { db } = await import('@/db');
  const { newsletterSubscribers, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const recipients = await db.select({ id: newsletterSubscribers.id, email: newsletterSubscribers.normalizedEmail })
    .from(newsletterSubscribers).where(eq(newsletterSubscribers.status, 'ACTIVE'));
  if (!recipients.length) return NextResponse.json({ error: 'Gönderilecek aktif abone bulunamadı.' }, { status: 422 });
  const subject = sanitizeText(parsed.data.subject).slice(0, 200);
  const linkOrigin = await resolveEmailLinkOrigin(req);
  const outcomes = await Promise.all(recipients.map(async (recipient) => {
    const unsubscribeUrl = await createUnsubscribeUrl(recipient.id, linkOrigin);
    const footer = unsubscribeUrl
      ? `<hr><p style="font-size:12px;color:#666">Bu e-postayı almak istemiyorsanız <a href="${unsubscribeUrl}">abonelikten ayrılın</a>.</p>`
      : `<hr><p style="font-size:12px;color:#666">Abonelikten çıkış bağlantısı şu anda oluşturulamadı.</p>`;
    const plainFooter = unsubscribeUrl
      ? `\n\nAbonelikten ayrıl: ${unsubscribeUrl}`
      : '\n\nAbonelikten çıkış bağlantısı şu anda oluşturulamadı.';
    return sendEmailDetailed({
      to: recipient.email, subject, html: `${parsed.data.html}${footer}`, text: `${parsed.data.text ?? ''}${plainFooter}`,
      linkOriginMode: linkOrigin.mode, previewDomainUsed: linkOrigin.isPreviewDomain,
    });
  }));
  const accepted = outcomes.filter((result) => result.ok).length;
  const failureCodes = [...new Set(outcomes.filter((result) => !result.ok).map((result) => result.code))];
  const result = {
    recipientCount: recipients.length, acceptedCount: accepted, rejectedCount: recipients.length - accepted, failureCodes,
    emailLinkOrigin: linkOrigin.mode, previewDomainUsed: linkOrigin.isPreviewDomain,
  };
  await db.insert(auditLogs).values({
    adminUserId: session.adminId ?? null, action: 'NEWSLETTER_SEND', entityType: 'newsletter',
    metadata: {
      ...result, subjectLength: subject.length,
      note: linkOrigin.isPreviewDomain ? 'Bu gönderimdeki abonelikten çıkma bağlantısı bir önizleme (.replit.dev) adresi kullandı.' : undefined,
    },
  }).catch(() => {});
  if (!accepted && failureCodes.includes('SMTP_NOT_CONFIGURED')) {
    return NextResponse.json({ error: 'SMTP yapılandırılmamış. E-posta Ayarları bölümünde sunucu, port, kullanıcı adı, parola ve gönderen adresini girip etkinleştirin.', result }, { status: 503 });
  }
  return NextResponse.json({ ok: accepted === recipients.length, result }, { status: accepted ? 200 : 502 });
}