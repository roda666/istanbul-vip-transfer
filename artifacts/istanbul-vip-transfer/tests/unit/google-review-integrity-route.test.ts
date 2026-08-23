import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock('@/lib/i18n/locale-registry', () => ({
  ALL_LOCALE_CODES: ['tr', 'en'],
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.select,
    update: mocks.update,
    delete: mocks.remove,
  },
}));

vi.mock('@/db/schema', () => ({
  googleReviews: { id: 'id', source: 'source' },
  auditLogs: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

import { DELETE, PATCH } from '@/app/admin/api/homepage/reviews/[id]/route';

function sourceQuery(source: string) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ source }]),
  };
}

function request(method: 'PATCH' | 'DELETE', body?: object) {
  return new NextRequest('https://example.test/admin/api/homepage/reviews/review-id', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Google review source integrity', () => {
  beforeEach(() => {
    mocks.requireAdminSession.mockReset();
    mocks.requireAdminSession.mockResolvedValue({ adminId: 'admin-id' });
    mocks.select.mockReset();
    mocks.update.mockReset();
    mocks.remove.mockReset();
    mocks.select.mockReturnValue(sourceQuery('google_business'));
  });

  it('does not allow a synced Google review text, author, rating, date, or language to be changed', async () => {
    const response = await PATCH(request('PATCH', { reviewText: 'Manually replaced content' }), {
      params: Promise.resolve({ id: 'review-id' }),
    });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/değiştirilemez/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('does not allow a synced Google review to be deleted', async () => {
    const response = await DELETE(request('DELETE'), {
      params: Promise.resolve({ id: 'review-id' }),
    });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/silinemez/i);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});