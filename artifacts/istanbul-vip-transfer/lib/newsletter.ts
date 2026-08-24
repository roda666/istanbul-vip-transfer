import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { sendEmailDetailed } from '@/lib/email';
import { buildEmailLink, resolveEmailLinkOrigin, type EmailLinkOriginStatus } from '@/lib/email-link-url';

const TOKEN_BYTES = 32;
const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;
const UNSUBSCRIBE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function issueToken(subscriberId: string, purpose: 'CONFIRM' | 'UNSUBSCRIBE') {
  const { db } = await import('@/db');
  const { newsletterTokens } = await import('@/db/schema');
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  await db.insert(newsletterTokens).values({
    subscriberId, tokenHash: hash(token), purpose,
    expiresAt: new Date(Date.now() + (purpose === 'CONFIRM' ? CONFIRM_TTL_MS : UNSUBSCRIBE_TTL_MS)),
  });
  return token;
}

/** Creates (or refreshes) a PENDING subscription and sends its opt-in message. */
export async function startNewsletterOptIn(input: {
  email: string; name: string; language: string; source: string; request?: Request;
}) {
  const { db } = await import('@/db');
  const { newsletterSubscribers, newsletterConsentEvents } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const existing = await db.select({ id: newsletterSubscribers.id, status: newsletterSubscribers.status })
    .from(newsletterSubscribers).where(eq(newsletterSubscribers.normalizedEmail, input.email)).limit(1);
  let subscriberId: string;
  if (existing[0]) {
    subscriberId = existing[0].id;
    // An explicit new consent may retry an expired confirmation, but never
    // silently reactivates an opted-out address.
    if (existing[0].status === 'UNSUBSCRIBED' || existing[0].status === 'SUPPRESSED') return { status: existing[0].status, delivery: null };
    await db.update(newsletterSubscribers).set({
      status: 'PENDING', name: input.name, preferredLanguage: input.language, updatedAt: new Date(),
    }).where(eq(newsletterSubscribers.id, subscriberId));
  } else {
    const [row] = await db.insert(newsletterSubscribers).values({
      normalizedEmail: input.email, name: input.name, preferredLanguage: input.language,
      status: 'PENDING', source: input.source,
    }).returning({ id: newsletterSubscribers.id });
    subscriberId = row.id;
  }
  await db.insert(newsletterConsentEvents).values({
    subscriberId, normalizedEmail: input.email, action: 'REQUESTED',
    consentTextVersion: '2026-07-28-v1', language: input.language, source: input.source,
  });
  const token = await issueToken(subscriberId, 'CONFIRM');
  const linkOrigin = await resolveEmailLinkOrigin(input.request);
  const link = buildEmailLink(linkOrigin.baseUrl, '/newsletter/confirm', { token });
  const noLinkText = 'Güvenli doğrulama bağlantısı şu anda oluşturulamadı. Lütfen daha sonra tekrar deneyin.';
  const delivery = await sendEmailDetailed({
    to: input.email, subject: 'Bülten aboneliğinizi doğrulayın',
    text: link
      ? `Bülten aboneliğinizi etkinleştirmek için bu bağlantıyı açın: ${link}`
      : noLinkText,
    html: link
      ? `<p>Bülten aboneliğinizi etkinleştirmek için <a href="${link}">buraya tıklayın</a>.</p><p>Bu bağlantı 48 saat geçerlidir.</p>`
      : `<p>${noLinkText}</p>`,
  });
  return { status: 'PENDING', delivery, linkOrigin, link };
}

export async function consumeNewsletterToken(token: string, purpose: 'CONFIRM' | 'UNSUBSCRIBE') {
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return null;
  const { db } = await import('@/db');
  const { newsletterTokens, newsletterSubscribers, newsletterConsentEvents } = await import('@/db/schema');
  const now = new Date();
  const [row] = await db.select({ id: newsletterTokens.id, subscriberId: newsletterTokens.subscriberId, email: newsletterSubscribers.normalizedEmail, language: newsletterSubscribers.preferredLanguage })
    .from(newsletterTokens).innerJoin(newsletterSubscribers, eq(newsletterTokens.subscriberId, newsletterSubscribers.id))
    .where(and(eq(newsletterTokens.tokenHash, hash(token)), eq(newsletterTokens.purpose, purpose), isNull(newsletterTokens.usedAt), gt(newsletterTokens.expiresAt, now))).limit(1);
  if (!row) return null;
  // The used-at predicate makes a link single-use even when opened concurrently.
  const used = await db.update(newsletterTokens).set({ usedAt: now })
    .where(and(eq(newsletterTokens.id, row.id), isNull(newsletterTokens.usedAt))).returning({ id: newsletterTokens.id });
  if (!used[0]) return null;
  const status = purpose === 'CONFIRM' ? 'ACTIVE' : 'UNSUBSCRIBED';
  await db.update(newsletterSubscribers).set({ status, updatedAt: now }).where(eq(newsletterSubscribers.id, row.subscriberId));
  await db.insert(newsletterConsentEvents).values({
    subscriberId: row.subscriberId, normalizedEmail: row.email,
    action: purpose === 'CONFIRM' ? 'GRANTED' : 'WITHDRAWN',
    consentTextVersion: '2026-07-28-v1', language: row.language, source: `newsletter-${purpose.toLowerCase()}`,
  });
  return status;
}

export async function createUnsubscribeUrl(
  subscriberId: string,
  linkOrigin: EmailLinkOriginStatus,
) {
  const token = await issueToken(subscriberId, 'UNSUBSCRIBE');
  return buildEmailLink(linkOrigin.baseUrl, '/newsletter/unsubscribe', { token });
}