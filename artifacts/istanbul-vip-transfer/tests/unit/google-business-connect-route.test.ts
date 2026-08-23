import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireSocialPlatformAdmin: vi.fn(),
}));

vi.mock('@/lib/social-auth', () => ({
  requireSocialPlatformAdmin: mocks.requireSocialPlatformAdmin,
  socialAuthErrorResponse: vi.fn(() => ({ error: 'Unauthorized', status: 401 })),
}));

import { GET } from '@/app/admin/api/social-platforms/google-business/connect/route';

function request() {
  return new NextRequest('https://preview.example/admin/api/social-platforms/google-business/connect', {
    headers: { 'x-forwarded-host': 'preview.example' },
  });
}

describe('Google Business OAuth connect route', () => {
  beforeEach(() => {
    mocks.requireSocialPlatformAdmin.mockReset();
    mocks.requireSocialPlatformAdmin.mockResolvedValue({ isLoggedIn: true, role: 'ADMIN' });
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-client-secret');
  });

  it('starts a scoped, offline OAuth flow with state held in an httpOnly cookie', async () => {
    const response = await GET(request());
    const location = response.headers.get('location') ?? '';
    const cookies = response.headers.getSetCookie().join('\n');

    expect(response.status).toBe(307);
    expect(location).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(location).toContain(encodeURIComponent('https://www.googleapis.com/auth/business.manage'));
    expect(location).toContain('access_type=offline');
    expect(cookies).toContain('google_business_oauth_state=');
    expect(cookies).toContain('HttpOnly');
  });

  it('does not start OAuth when the Google client configuration is incomplete', async () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    const response = await GET(request());
    expect(response.headers.get('location')).toContain('social_error=google_business_credentials_missing');
  });

  it('ignores an untrusted forwarded host when building the OAuth redirect URI', async () => {
    vi.stubEnv('REPLIT_DOMAINS', 'www.istanbulviptransfer.com');
    vi.stubEnv('REPLIT_DEV_DOMAIN', '');
    const hostileRequest = new NextRequest('https://attacker.example/admin/api/social-platforms/google-business/connect', {
      headers: { 'x-forwarded-host': 'attacker.example', host: 'attacker.example' },
    });

    const response = await GET(hostileRequest);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://www.istanbulviptransfer.com/admin/api/social-platforms/google-business/callback',
    );
  });
});