import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { computeBlogHealthIssues, getTranslationLocales, getKnownBlogSlugs } from '@/lib/blog-health';

const INTERVAL_MS = 60 * 60 * 1_000;
const COOLDOWN_MS = 6 * 60 * 60 * 1_000;
let started = false;
const LEASE_NAME = 'blog-health-check';
const LEASE_TTL_MS = 10 * 60 * 1_000;

export function ownsHealthCheckLease(rowOwner: string | undefined, ownerToken: string): boolean {
  return rowOwner === ownerToken;
}

export function escapeBlogHealthHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]!));
}

export function isMissingBlogHealthTableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (message.includes('relation') && message.includes('does not exist'))
    || (err as { code?: string }).code === '42P01';
}

export async function runBlogHealthCheck(): Promise<
  | { status: 'complete'; unhealthyCount: number }
  | { status: 'skipped_missing_tables' }
  | { status: 'skipped_overlap' }
  | { status: 'failed' }
> {
  let leaseOwner: string | null = null;
  let leaseDb: typeof import('@/db')['db'] | null = null;
  let leaseSchema: typeof import('@/db/schema') | null = null;
  try {
    const [{ db }, schema, { eq, inArray, and }, email] = await Promise.all([
      import('@/db'), import('@/db/schema'), import('drizzle-orm'), import('@/lib/email'),
    ]);
    leaseDb = db;
    leaseSchema = schema;
    const ownerToken = randomUUID();
    const lease = await db.insert(schema.healthCheckLeases)
      .values({ lockName: LEASE_NAME, ownerToken, expiresAt: new Date(Date.now() + LEASE_TTL_MS) })
      .onConflictDoUpdate({
        target: schema.healthCheckLeases.lockName,
        set: { ownerToken, expiresAt: new Date(Date.now() + LEASE_TTL_MS) },
        where: sql`${schema.healthCheckLeases.expiresAt} < now()`,
      })
      .returning({ ownerToken: schema.healthCheckLeases.ownerToken });
    if (!ownsHealthCheckLease(lease[0]?.ownerToken, ownerToken)) return { status: 'skipped_overlap' };
    leaseOwner = ownerToken;
    const sources = await db.select({ id: schema.content.id, slug: schema.content.slug, title: schema.content.title })
      .from(schema.content).where(eq(schema.content.contentType, 'BLOG_POST'));
    const ids = sources.map(row => row.id);
    const translations = ids.length
      ? await db.select({
          entityId: schema.contentTranslations.entityId,
          targetLanguageCode: schema.contentTranslations.targetLanguageCode,
          status: schema.contentTranslations.status,
      }).from(schema.contentTranslations).where(and(
        eq(schema.contentTranslations.entityType, 'content'),
        inArray(schema.contentTranslations.entityId, ids),
      ))
      : [];
    const unhealthy = computeBlogHealthIssues(
      getKnownBlogSlugs(),
      sources,
      translations.map(row => ({ entityId: row.entityId!, targetLanguageCode: row.targetLanguageCode, status: row.status })),
      getTranslationLocales(),
    );
    await db.insert(schema.blogHealthRuns).values({
      unhealthyCount: unhealthy.length,
      result: unhealthy as unknown as Record<string, unknown>[],
    });
    if (!unhealthy.length) return { status: 'complete', unhealthyCount: 0 };

    const slugs = unhealthy.map(item => item.slug);
    const old = await db.select().from(schema.blogHealthAlerts)
      .where(inArray(schema.blogHealthAlerts.slug, slugs));
    const cutoff = Date.now() - COOLDOWN_MS;
    const toAlert = unhealthy.filter(item => {
      const previous = old.find(row => row.slug === item.slug);
      return !previous || new Date(previous.lastAlertAt).getTime() <= cutoff;
    });
    if (!toAlert.length) return { status: 'complete', unhealthyCount: unhealthy.length };
    const recipients = await email.getAdminNotifyEmails();
    if (!recipients.length) return { status: 'complete', unhealthyCount: unhealthy.length };
    const text = toAlert.map(item =>
      `${item.title ?? item.slug} (/${item.slug}): ${item.issues.join(', ')}`,
    ).join('\n');
    const delivered = await email.sendEmail({
      to: recipients.join(', '),
      subject: `⚠️ ${toAlert.length} blog translation health issue${toAlert.length === 1 ? '' : 's'}`,
      html: `<p>Blog health issues detected:</p><ul>${toAlert.map(item =>
        `<li><strong>${escapeBlogHealthHtml(item.title ?? item.slug)}</strong> (/${escapeBlogHealthHtml(item.slug)}): ${item.issues.map(escapeBlogHealthHtml).join(', ')}</li>`,
      ).join('')}</ul>`,
      text,
      source: 'blog-health-scheduler',
    });
    if (!delivered) return { status: 'complete', unhealthyCount: unhealthy.length };
    for (const item of toAlert) {
      await db.insert(schema.blogHealthAlerts)
        .values({ slug: item.slug, issues: item.issues, lastAlertAt: new Date() })
        .onConflictDoUpdate({
          target: schema.blogHealthAlerts.slug,
          set: { issues: item.issues, lastAlertAt: new Date() },
        });
    }
    return { status: 'complete', unhealthyCount: unhealthy.length };
  } catch (error) {
    if (isMissingBlogHealthTableError(error)) {
      console.warn('[blog-health] Skipped — health tables are missing; run migrations.');
      return { status: 'skipped_missing_tables' };
    }
    console.error('[blog-health] Check failed:', error);
    return { status: 'failed' };
  } finally {
    if (leaseDb && leaseSchema && leaseOwner) {
      try {
        await leaseDb.delete(leaseSchema.healthCheckLeases).where(sql`${leaseSchema.healthCheckLeases.lockName} = ${LEASE_NAME} AND ${leaseSchema.healthCheckLeases.ownerToken} = ${leaseOwner}`);
      } catch (error) {
        if (!isMissingBlogHealthTableError(error)) console.warn('[blog-health] Lease release failed.');
      }
    }
  }
}

export function startBlogHealthScheduler(): void {
  if (started) return;
  started = true;
  setTimeout(() => void runBlogHealthCheck(), 30_000);
  setInterval(() => void runBlogHealthCheck(), INTERVAL_MS);
}