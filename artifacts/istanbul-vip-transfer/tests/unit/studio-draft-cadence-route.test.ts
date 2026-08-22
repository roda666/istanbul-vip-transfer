import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  hasAdminPermission: vi.fn(),
  insert: vi.fn(),
  aiDraftCadenceSettings: { id: Symbol('cadence-id') },
}));

vi.mock('@/lib/auth/session', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));
vi.mock('@/lib/auth/authorization', () => ({
  hasAdminPermission: mocks.hasAdminPermission,
}));
vi.mock('@/db', () => ({
  db: { insert: mocks.insert },
}));
vi.mock('@/db/schema', () => ({
  aiDraftCadenceSettings: mocks.aiDraftCadenceSettings,
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  sql: vi.fn(),
}));

import { GET } from '../../app/admin/api/studio/draft-cadence/route';

describe('AI Studio draft cadence endpoint', () => {
  beforeEach(() => {
    mocks.requireAdminSession.mockReset().mockResolvedValue({ adminId: 'admin-id', role: 'ADMIN' });
    mocks.hasAdminPermission.mockReset().mockReturnValue(true);
    mocks.insert.mockReset();
  });

  it('keeps access denial explicit', async () => {
    mocks.requireAdminSession.mockRejectedValue(new Error('no session'));

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it('returns a retryable schema diagnostic when cadence migration tables are absent', async () => {
    mocks.insert.mockImplementation(() => ({
      values: () => ({
        onConflictDoNothing: () => Promise.reject({ code: '42P01' }),
      }),
    }));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('şeması eksik'),
    });
  });
});