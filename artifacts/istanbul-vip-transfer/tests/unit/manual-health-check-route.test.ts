import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  runServiceHealthCheck: vi.fn(),
  sendEmailDetailed: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock('@/lib/service-health-scheduler', () => ({
  runServiceHealthCheck: mocks.runServiceHealthCheck,
}));
vi.mock('@/lib/email', () => ({
  sendEmailDetailed: mocks.sendEmailDetailed,
}));

import { POST } from '../../app/admin/api/service-pages/check/route';

describe('manual service health check endpoint', () => {
  beforeEach(() => {
    mocks.requireAdminSession.mockResolvedValue({ isLoggedIn: true });
    mocks.runServiceHealthCheck.mockReset();
    mocks.sendEmailDetailed.mockReset();
    process.env.ADMIN_EMAIL = 'admin@example.com';
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
    mocks.sendEmailDetailed.mockResolvedValue({
      ok: true,
      code: 'SMTP_ACCEPTED',
      message: 'accepted',
      acceptedCount: 1,
      rejectedCount: 0,
      serverResponse: '250 accepted',
    });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      status: 'complete',
      unhealthyCount: 0,
      emailDelivery: 'SMTP_ACCEPTED',
    });
    expect(mocks.sendEmailDetailed).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@example.com',
      source: 'manual-health-check',
    }));
  });

  it('reports a failed test delivery even when the health check completes', async () => {
    mocks.runServiceHealthCheck.mockResolvedValue({ status: 'complete', unhealthyCount: 0 });
    mocks.sendEmailDetailed.mockResolvedValue({
      ok: false,
      code: 'SMTP_AUTH_FAILED',
      message: 'SMTP kimlik doğrulaması başarısız oldu.',
      acceptedCount: 0,
      rejectedCount: 0,
      serverResponse: 'authentication failed',
    });

    const response = await POST();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      emailDelivery: 'SMTP_AUTH_FAILED',
      error: expect.stringContaining('test e-postası teslim edilemedi'),
    });
  });
});