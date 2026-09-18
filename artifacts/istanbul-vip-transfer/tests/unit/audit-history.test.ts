import { describe, expect, it } from 'vitest';
import { getAuditActionLabel, getAuditRecordLabel } from '../../lib/audit-history-display';

describe('audit history display helpers', () => {
  it('uses only allowlisted metadata labels and safely truncates ids', () => {
    expect(getAuditRecordLabel('123456789012345678901234567890123456', {
      title: 'Transfer talebi',
      secret: 'must not be shown',
    })).toBe('Transfer talebi · 12345678901234567890123456789012…');
    expect(getAuditRecordLabel('record-id', { secret: 'hidden' })).toBe('record-id');
  });

  it('provides readable labels for known and unknown actions', () => {
    expect(getAuditActionLabel('DELETE')).toBe('Sildi');
    expect(getAuditActionLabel('QUOTE_RESPONSE')).toBe('Teklif yanıtladı');
    expect(getAuditActionLabel('SOME_NEW_ACTION')).toBe('some new action');
  });
});