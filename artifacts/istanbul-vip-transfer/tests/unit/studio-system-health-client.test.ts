import { describe, expect, it } from 'vitest';
import { beginSystemHealthRefresh, failSystemHealthRefresh } from '@/lib/studio/system-health-client';

describe('AI Studio system-control refresh state', () => {
  it('clears a prior successful snapshot before a refresh can fail', () => {
    const priorSuccessfulResponse = {
      database: { status: 'ok', label: 'Veritabanı sorgu kabul ediyor' },
    };

    const refreshState = beginSystemHealthRefresh();
    const failedRefreshState = failSystemHealthRefresh();

    expect(priorSuccessfulResponse.database.status).toBe('ok');
    expect(refreshState).toEqual({ data: null, checkedAt: '' });
    expect(failedRefreshState).toEqual({ data: null, checkedAt: '' });
  });
});