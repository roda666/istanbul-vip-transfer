import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  fetchPageSearchAnalytics: vi.fn(),
}));
vi.mock('@/lib/auth/session', () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock('@/lib/gsc', () => ({ fetchPageSearchAnalytics: mocks.fetchPageSearchAnalytics }));

import { GET } from '@/app/admin/api/gsc/pages/route';

describe('GSC page analytics route', () => {
  beforeEach(() => {
    mocks.requireAdminSession.mockReset();
    mocks.fetchPageSearchAnalytics.mockReset();
    mocks.requireAdminSession.mockResolvedValue({ adminId: 'admin' });
  });

  it('requires an admin session', async () => {
    mocks.requireAdminSession.mockRejectedValueOnce(new Error('no session'));
    const response = await GET(new NextRequest('https://example.test/admin/api/gsc/pages?startDate=2024-01-01&endDate=2024-01-02'));
    expect(response.status).toBe(401);
    expect(mocks.fetchPageSearchAnalytics).not.toHaveBeenCalled();
  });

  it('does not expose provider failures', async () => {
    mocks.fetchPageSearchAnalytics.mockResolvedValueOnce({ ok: false, reason: 'api_error' });
    const response = await GET(new NextRequest('https://example.test/admin/api/gsc/pages?startDate=2024-01-01&endDate=2024-01-02'));
    expect(await response.json()).toEqual({ error: 'gsc_page_analytics_unavailable', rows: [] });
  });
});