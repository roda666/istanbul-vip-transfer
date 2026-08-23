import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireAdminSession: vi.fn() }));

vi.mock('@/lib/auth/session', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

import { POST } from '../../app/admin/api/studio/projects/[id]/image/route';

describe('retired studio project image endpoint', () => {
  beforeEach(() => {
    mocks.requireAdminSession.mockReset().mockResolvedValue({ adminId: 'admin-id' });
  });

  it('does not generate or persist legacy project images', async () => {
    const response = await POST(new Request('http://localhost/admin/api/studio/projects/id/image', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://provider.example/temporary.png', altText: 'Temporary image' }),
    }) as never, { params: Promise.resolve({ id: 'id' }) });

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      redirectTo: '/admin/ai-studio/gorsel-uret',
      error: expect.stringContaining('GPT Image 2'),
    });
  });

  it('still requires an admin session', async () => {
    mocks.requireAdminSession.mockRejectedValue(new Error('no session'));
    const response = await POST(new Request('http://localhost') as never, { params: Promise.resolve({ id: 'id' }) });
    expect(response.status).toBe(401);
  });
});