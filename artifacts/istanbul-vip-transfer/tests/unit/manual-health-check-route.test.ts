import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  runServiceHealthCheck: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock('@/lib/service-health-scheduler', () => ({
  runServiceHealthCheck: mocks.runServiceHealthCheck,
}));

import { POST } from '../../app/admin/api/service-pages/check/route';

describe('manual service health check endpoint', () => {
  beforeEach(() => {
    mocks.requireAdminSession.mockResolvedValue({ isLoggedIn: true });
    mocks.runServiceHealthCheck.mockReset();
  });

  it('returns an explicit 503 warning when health tables cannot be queried', async () => {
    mocks.runServiceHealthCheck.mockResolvedValue({ status: 'skipped_missing_tables' });

    const response = await POST();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      status: 'skipped_missing_tables',
      error: expect.stringContaining('tabloları erişilemedi'),
    });
  });

  it('keeps successful health checks explicitly successful', async () => {
    mocks.runServiceHealthCheck.mockResolvedValue({ status: 'complete', unhealthyCount: 0 });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      status: 'complete',
      unhealthyCount: 0,
    });
  });
});