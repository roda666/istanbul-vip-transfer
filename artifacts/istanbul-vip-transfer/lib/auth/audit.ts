import { db } from '@/db';
import { auditLogs } from '@/db/schema';

type AuditMetadata = Record<string, string | number | boolean | null | undefined>;

/**
 * Safe, best-effort security audit writer. Its metadata type intentionally
 * excludes request bodies, headers, tokens, passwords and session payloads.
 */
export async function writeAdminSecurityAudit(input: {
  adminUserId?: string | null;
  action: 'ADMIN_ACCESS_DENIED' | 'ADMIN_MUTATION_AUTHORIZED';
  pathname: string;
  method: string;
  permission?: string;
  reason?: string;
}) {
  const metadata: AuditMetadata = {
    method: input.method.toUpperCase(),
    permission: input.permission,
    reason: input.reason,
  };

  try {
    await db.insert(auditLogs).values({
      adminUserId: input.adminUserId ?? null,
      action: input.action,
      entityType: 'AdminAccess',
      entityId: input.pathname.slice(0, 240),
      metadata,
    });
  } catch {
    // Authorization must never become available because an audit insert failed.
  }
}