import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { randomUUID } from 'node:crypto';

type AuditMetadata = Record<string, string | number | boolean | null | undefined>;

const ADMIN_API_AUDIT_CATEGORIES = new Set([
  'ai-content', 'ai-suggestions', 'analytics', 'auth', 'blog', 'categories',
  'change-password', 'chatbot', 'content', 'cron', 'custom-fields',
  'email-settings', 'faqs', 'google-ads', 'gsc', 'homepage', 'languages',
  'locations', 'login', 'logout', 'nav', 'newsletter', 'newsletter-export',
  'requests', 'reservation-settings', 'service-pages', 'service-types',
  'settings', 'social-platforms', 'staff', 'storage', 'studio',
  'topic-clusters', 'transfer-routes', 'translations', 'vehicles',
]);

const ADMIN_PAGE_AUDIT_CATEGORIES = new Set([
  'ai-oneriler', 'ai-studio', 'araclar', 'ayarlar', 'blog',
  'bulten-aboneleri', 'ceviriler', 'dashboard', 'dil-ve-ceviri', 'diller',
  'e-posta-ayarlari', 'erisim-reddedildi', 'gecmis', 'hesabim', 'hizmetler',
  'istatistikler', 'kategoriler', 'menu', 'personel',
  'rezervasyon-ayarlari', 'sayfalar', 'sohbet', 'sss', 'talepler',
  'transfer-rotalari',
]);

/**
 * Audit data must not retain request-controlled route parameters. This stores
 * only an allowlisted admin area/category, never IDs, slugs, query strings or
 * path segments supplied by the request.
 */
export function normalizeAdminAuditPath(pathname: string): string {
  const segments = pathname.split(/[?#]/, 1)[0].split('/').filter(Boolean);
  if (segments[0] !== 'admin') return '/admin';
  if (segments[1] === 'api') {
    const category = segments[2];
    return ADMIN_API_AUDIT_CATEGORIES.has(category) ? `/admin/api/${category}` : '/admin/api/unknown';
  }
  if (!segments[1]) return '/admin';
  return ADMIN_PAGE_AUDIT_CATEGORIES.has(segments[1]) ? `/admin/${segments[1]}` : '/admin/page';
}

export type AdminAuditReason =
  | 'inactive_or_stale_session'
  | 'invalid_role'
  | 'permission_denied'
  | 'unmapped_admin_route'
  | 'csrf_origin_mismatch'
  | 'storage_unavailable'
  | 'storage_signing_failed';

export type AdminSecurityAuditRecord = {
  adminUserId: string | null;
  action: 'ADMIN_ACCESS_DENIED' | 'ADMIN_MUTATION_AUTHORIZED' | 'ADMIN_OPERATION_FAILED';
  pathname: string;
  method: string;
  permission?: string;
  reason?: AdminAuditReason;
  metadata: AuditMetadata;
};

export type AdminSecurityAuditResult =
  | { ok: true; attemptId: string }
  | { ok: false; attemptId: string; code: 'AUDIT_WRITE_FAILED' };

type AuditInsert = (record: AdminSecurityAuditRecord) => Promise<void>;
type AuditFailureLogger = (event: 'ADMIN_AUDIT_WRITE_FAILED', details: {
  attemptId: string;
  action: AdminSecurityAuditRecord['action'];
  pathname: string;
  method: string;
  permission?: string;
  reason?: AdminAuditReason;
  errorClass: string;
}) => void;

async function insertAuditRecord(record: AdminSecurityAuditRecord): Promise<void> {
  await db.insert(auditLogs).values({
    adminUserId: record.adminUserId,
    action: record.action,
    entityType: 'AdminAccess',
    entityId: record.pathname,
    metadata: record.metadata,
  });
}

function defaultAuditFailureLogger(
  event: 'ADMIN_AUDIT_WRITE_FAILED',
  details: Parameters<AuditFailureLogger>[1],
) {
  // Deliberately log only a bounded, allowlisted event shape. Never log the
  // thrown error itself because drivers may include query values or secrets.
  console.error(event, details);
}

/**
 * Creates the security-audit writer with injectable persistence/logging so
 * success and controlled failure behavior can be tested without a database.
 */
export function createAdminSecurityAuditWriter(
  insert: AuditInsert = insertAuditRecord,
  logFailure: AuditFailureLogger = defaultAuditFailureLogger,
) {
  return async function writeAdminSecurityAudit(
    input: Omit<AdminSecurityAuditRecord, 'metadata' | 'adminUserId'> & {
      adminUserId?: string | null;
    },
  ): Promise<AdminSecurityAuditResult> {
    const attemptId = randomUUID();
    const pathname = normalizeAdminAuditPath(input.pathname);
    const method = input.method.toUpperCase();
    const metadata: AuditMetadata = {
      auditAttemptId: attemptId,
      method,
      permission: input.permission,
      reason: input.reason,
    };
    const record: AdminSecurityAuditRecord = {
      adminUserId: input.adminUserId ?? null,
      action: input.action,
      pathname,
      method,
      permission: input.permission,
      reason: input.reason,
      metadata,
    };

    try {
      await insert(record);
      return { ok: true, attemptId };
    } catch (error) {
      const failureDetails = {
        attemptId,
        action: record.action,
        pathname,
        method,
        permission: record.permission,
        reason: record.reason,
        errorClass: error instanceof Error ? error.constructor.name : 'UnknownError',
      };
      try {
        logFailure('ADMIN_AUDIT_WRITE_FAILED', failureDetails);
      } catch {
        // Logging must never weaken or alter the already-made auth decision.
        // The fallback retains only the stable event ID and no request data.
        try {
          console.error('ADMIN_AUDIT_FAILURE_LOGGER_UNAVAILABLE', { attemptId });
        } catch {
          // Ignore an unavailable console sink as well.
        }
      }
      return { ok: false, attemptId, code: 'AUDIT_WRITE_FAILED' };
    }
  };
}

/**
 * Safe, best-effort security audit writer. Its metadata type intentionally
 * excludes request bodies, headers, tokens, passwords and session payloads.
 * A failed write is visible through the structured ADMIN_AUDIT_WRITE_FAILED
 * log event and a typed result, while authorization continues unchanged.
 */
export const writeAdminSecurityAudit = createAdminSecurityAuditWriter();