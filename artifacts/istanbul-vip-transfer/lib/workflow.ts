/**
 * Content approval and scheduling workflow rules.
 * All rules here are enforced server-side in API routes.
 * The public site uses isPubliclyVisible() to gate content display.
 */

export type ContentStatus =
  | 'DRAFT'
  | 'RESEARCH'
  | 'REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'ARCHIVED';

/**
 * Determines whether content is publicly visible.
 *
 * Rules (from spec):
 * - PUBLISHED: requires approvedAt and approvedBy
 * - SCHEDULED: requires approvedAt, approvedBy, AND scheduledAt <= now
 * - All other statuses: not public
 *
 * No cron job needed — this is evaluated on every request.
 */
export function isPubliclyVisible(content: {
  status: ContentStatus;
  approvedAt: Date | null;
  approvedBy: string | null;
  scheduledAt: Date | null;
}): boolean {
  const { status, approvedAt, approvedBy, scheduledAt } = content;

  if (status === 'PUBLISHED' && approvedAt && approvedBy) {
    return true;
  }

  if (
    status === 'SCHEDULED' &&
    approvedAt &&
    approvedBy &&
    scheduledAt &&
    scheduledAt <= new Date()
  ) {
    return true;
  }

  return false;
}

/**
 * Returns true if editing content with this status should reset approval.
 * APPROVED and SCHEDULED content reverts to REVIEW on any edit.
 */
export function requiresApprovalReset(status: ContentStatus): boolean {
  return status === 'APPROVED' || status === 'SCHEDULED';
}

/**
 * Returns the fields to set when resetting approval, or null if not needed.
 */
export function getApprovalReset(
  currentStatus: ContentStatus,
): { status: ContentStatus; approvedAt: null; approvedBy: null } | null {
  if (!requiresApprovalReset(currentStatus)) return null;
  return { status: 'REVIEW', approvedAt: null, approvedBy: null };
}

/**
 * Validates a requested status transition.
 * Returns an error message string if disallowed, or null if allowed.
 */
export function validateStatusTransition(
  to: ContentStatus,
  options: {
    isAiGenerated?: boolean;
    isApproved?: boolean;
    hasScheduledAt?: boolean;
  } = {},
): string | null {
  // AI-generated content may only be RESEARCH or DRAFT
  if (options.isAiGenerated && to !== 'RESEARCH' && to !== 'DRAFT') {
    return 'AI içeriği yalnızca ARAŞTIRMA veya TASLAK durumuna alınabilir.';
  }

  // SCHEDULED requires prior APPROVED status
  if (to === 'SCHEDULED' && !options.isApproved) {
    return 'İçeriği zamanlamak için önce onaylanmış olması gerekir.';
  }

  // SCHEDULED requires a scheduledAt datetime
  if (to === 'SCHEDULED' && !options.hasScheduledAt) {
    return 'Zamanlanmış içerik için bir yayın tarihi belirtilmelidir.';
  }

  return null;
}

export const STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: 'Taslak',
  RESEARCH: 'Araştırma',
  REVIEW: 'İnceleme',
  APPROVED: 'Onaylandı',
  SCHEDULED: 'Zamanlandı',
  PUBLISHED: 'Yayınlandı',
  ARCHIVED: 'Arşivlendi',
};

export const STATUS_COLORS: Record<
  ContentStatus,
  { bg: string; text: string }
> = {
  DRAFT:     { bg: '#F1F5F9', text: '#64748B' },
  RESEARCH:  { bg: '#EFF6FF', text: '#2563EB' },
  REVIEW:    { bg: '#FFFBEB', text: '#D97706' },
  APPROVED:  { bg: '#F0FDF4', text: '#168C5B' },
  SCHEDULED: { bg: '#F5F3FF', text: '#7C3AED' },
  PUBLISHED: { bg: '#ECFDF5', text: '#059669' },
  ARCHIVED:  { bg: '#F8FAFC', text: '#64748B' },
};
