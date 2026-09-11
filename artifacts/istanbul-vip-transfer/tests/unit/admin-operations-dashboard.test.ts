import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getIstanbulCalendarDate, getIstanbulDayBounds } from '@/lib/istanbul-time';
import { canAssignDriver, formatTransferCountdown, selectNextTransfer } from '@/lib/operations';
import { getAdminApiPermission } from '@/lib/auth/authorization';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Istanbul operation boundaries', () => {
  it('keeps the Istanbul calendar date at both UTC edges', () => {
    const beforeMidnight = new Date('2025-04-10T20:59:59.999Z');
    const afterMidnight = new Date('2025-04-10T21:00:00.000Z');
    expect(getIstanbulCalendarDate(0, beforeMidnight)).toBe('2025-04-10');
    expect(getIstanbulCalendarDate(0, afterMidnight)).toBe('2025-04-11');
  });
  it('returns an inclusive start and exclusive next-day end', () => {
    const bounds = getIstanbulDayBounds(0, new Date('2025-04-10T12:00:00Z'));
    expect(bounds.start.toISOString()).toBe('2025-04-09T21:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2025-04-10T21:00:00.000Z');
  });
});

describe('next transfer and assignment rules', () => {
  it('selects the soonest future operation and formats deterministic countdowns', () => {
    const now = new Date('2025-04-10T10:00:00Z');
    const items = [{ id: 'late', plannedPickupAt: '2025-04-10T12:00:00Z', driverId: null }, { id: 'soon', plannedPickupAt: '2025-04-10T11:00:00Z', driverId: null }];
    expect(selectNextTransfer(items, now)?.id).toBe('soon');
    expect(formatTransferCountdown('2025-04-10T11:01:00Z', now)).toBe('1 sa 1 dk kaldı');
    expect(formatTransferCountdown(null, now)).toContain('yok');
  });
  it('rejects inactive drivers and overlapping active assignments', () => {
    const pickup = new Date('2025-04-10T10:00:00Z');
    expect(canAssignDriver({ driverActive: false, pickupAt: pickup, otherPickups: [] })).toEqual({ ok: false, reason: 'INACTIVE_DRIVER' });
    expect(canAssignDriver({ driverActive: true, pickupAt: pickup, otherPickups: [new Date('2025-04-10T11:00:00Z')] })).toEqual({ ok: false, reason: 'OVERLAPPING_ASSIGNMENT' });
  });
});

describe('operation source contracts', () => {
  it('conversion requires explicit fields and does not read requestData', () => {
    const source = read('app/admin/api/requests/[id]/convert-to-transfer/route.ts');
    expect(source).toContain('plannedPickupAt');
    expect(source).toContain('routeSummary');
    expect(source).toContain('requestId');
    expect(source).not.toContain('request.requestData');
  });
  it('enforces idempotency with a unique requestId relation', () => {
    const schema = read('db/schema.ts');
    expect(schema).toContain("requestId: uuid('request_id').unique()");
    expect(read('app/admin/api/requests/[id]/convert-to-transfer/route.ts')).toContain('zaten transfere');
  });
  it('maps driver and transfer APIs to fleet authorization', () => {
    expect(getAdminApiPermission('/admin/api/drivers', 'POST')).toBe('FLEET_MANAGE');
    expect(getAdminApiPermission('/admin/api/transfers/1', 'PATCH')).toBe('FLEET_MANAGE');
  });
  it('keeps dashboard at exactly four semantic cards with state branches', () => {
    const source = read('app/admin/(protected)/dashboard/_DashboardOperations.tsx');
    expect((source.match(/<Card title=/g) ?? []).length).toBe(4);
    expect(source).toContain('Bugünkü transferler');
    expect(source).toContain('Atama bekleyen');
    expect(source).toContain('Yanıt bekleyen fiyat talepleri');
    expect(source).toContain('Yarınki transferler');
    expect(source).toContain('Yeniden dene');
    expect(source).toContain('Bugün planlanmış transfer bulunmuyor');
  });
  it('uses an explicit review marker rather than visibility for pending Google reviews', () => {
    const dashboard = read('app/admin/(protected)/dashboard/page.tsx');
    const reviewRoute = read('app/admin/api/homepage/reviews/[id]/route.ts');
    const schema = read('db/schema.ts');
    expect(schema).toContain("reviewedAt:            timestamp('reviewed_at'");
    expect(schema).toContain("reviewedBy:            uuid('reviewed_by')");
    expect(dashboard).toContain('isNull(googleReviews.reviewedAt)');
    expect(dashboard).not.toContain('eq(googleReviews.isVisible, false)');
    expect(reviewRoute).toContain('markReviewed');
    expect(reviewRoute).toContain('reviewedBy: markReviewed === true ? session.adminId');
    expect(reviewRoute).toContain('const { markReviewed, ...reviewFields } = parsed.data');
    expect(reviewRoute).toContain('...reviewFields');
    expect(reviewRoute).not.toContain('...data,');
    const homepage = read('app/admin/(protected)/sayfalar/ana-sayfa/_HomepageEditor.tsx');
    expect(homepage).toContain('/admin/api/homepage/reviews/${review.id}');
    expect(homepage).toContain('markReviewed: !review.reviewedAt');
    expect(homepage).toContain('İncelendi olarak işaretle');
  });
});