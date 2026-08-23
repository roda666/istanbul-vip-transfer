import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/db', () => ({ db: { execute: mocks.execute, update: mocks.update } }));
vi.mock('@/db/schema', () => ({ gscConnections: { id: 'id' } }));

import { fetchPageSearchAnalytics, validatePageAnalyticsOptions } from '@/lib/gsc';

describe('GSC page analytics', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.update.mockReset();
    mocks.set.mockReset();
    mocks.where.mockReset();
    mocks.fetch.mockReset();
    mocks.update.mockReturnValue({ set: mocks.set });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.where.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', mocks.fetch);
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
  });

  it('strictly validates ISO date ranges and bounded row limits', () => {
    expect(validatePageAnalyticsOptions({ startDate: '2024-02-30', endDate: '2024-03-01' }).ok).toBe(false);
    expect(validatePageAnalyticsOptions({ startDate: '2024-01-01', endDate: '2025-01-03' }).ok).toBe(false);
    expect(validatePageAnalyticsOptions({ startDate: '2024-01-01', endDate: '2024-01-02', limit: 0 })).toEqual(
      { ok: false, reason: 'invalid_limit' },
    );
    expect(validatePageAnalyticsOptions({ startDate: '2024-01-01', endDate: '2024-01-02', limit: 1001 }).ok).toBe(false);
  });

  it('requests the page dimension and maps provider metric rows', async () => {
    const connection = {
      site_url: 'https://example.com/', access_token: 'existing-token', refresh_token: 'refresh',
      token_expiry: new Date('2099-01-01'), connected: true, enabled: true, last_error: null,
      connected_email: null, connected_at: new Date(), updated_at: new Date(),
    };
    mocks.execute.mockResolvedValueOnce([connection]).mockResolvedValueOnce([connection]);
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      rows: [{ keys: ['https://example.com/page'], clicks: 4, impressions: 100, ctr: 0.04, position: 8.5 }],
    })));

    await expect(fetchPageSearchAnalytics({ startDate: '2024-01-01', endDate: '2024-01-31', limit: 20 }))
      .resolves.toEqual({ ok: true, rows: [{
        page: 'https://example.com/page', clicks: 4, impressions: 100, ctr: 0.04, position: 8.5,
      }] });
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({
      startDate: '2024-01-01', endDate: '2024-01-31', dimensions: ['page'], rowLimit: 20,
    });
  });

  it('returns a typed disconnected state without calling Google', async () => {
    mocks.execute.mockResolvedValueOnce([]);
    await expect(fetchPageSearchAnalytics({ startDate: '2024-01-01', endDate: '2024-01-02' }))
      .resolves.toEqual({ ok: false, reason: 'not_connected' });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('uses a Drizzle update for refreshed tokens, including quote-bearing values', async () => {
    const connection = {
      site_url: 'https://example.com/', access_token: null, refresh_token: 'refresh',
      token_expiry: null, connected: true, enabled: true, last_error: null,
      connected_email: null, connected_at: new Date(), updated_at: new Date(),
    };
    mocks.execute.mockResolvedValueOnce([connection]).mockResolvedValueOnce([connection]);
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "new'token", expires_in: 3600 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] })));

    await fetchPageSearchAnalytics({ startDate: '2024-01-01', endDate: '2024-01-02' });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "new'token" }));
    expect(mocks.where).toHaveBeenCalledTimes(1);
    expect(String(mocks.where.mock.calls[0][0])).not.toContain("new'token");
  });
});