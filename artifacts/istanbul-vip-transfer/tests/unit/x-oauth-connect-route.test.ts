import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireSocialPlatformAdmin: vi.fn(),
  isEncryptionReady: vi.fn(),
  twitterClient: vi.fn(),
}));

vi.mock('@/lib/social-auth', () => ({
  requireSocialPlatformAdmin: mocks.requireSocialPlatformAdmin,
}));

vi.mock('@/lib/email-crypto', () => ({
  encrypt: vi.fn(),
  isEncryptionReady: mocks.isEncryptionReady,
}));

vi.mock('twitter-api-v2', () => ({
  TwitterApi: mocks.twitterClient,
}));

import { GET } from '@/app/admin/api/social-platforms/x/connect/route';

function request() {
  return new NextRequest('https://preview.example/admin/api/social-platforms/x/connect', {
    headers: { 'x-forwarded-host': 'preview.example' },
  });
}

describe('X OAuth connect route', () => {
  beforeEach(() => {
    mocks.requireSocialPlatformAdmin.mockReset();
    mocks.requireSocialPlatformAdmin.mockResolvedValue({ isLoggedIn: true, role: 'ADMIN' });
    mocks.isEncryptionReady.mockReset();
    mocks.isEncryptionReady.mockReturnValue(true);
    mocks.twitterClient.mockReset();
    vi.stubEnv('X_CONSUMER_KEY', 'test-key');
    vi.stubEnv('X_CONSUMER_SECRET', 'test-secret');
  });

  it('returns a popup-safe, actionable result when X API credits are depleted', async () => {
    mocks.twitterClient.mockImplementation(function TwitterClient() {
      return {
        generateAuthLink: vi.fn().mockRejectedValue(new Error('X API 402: credits depleted')),
      };
    });

    const response = await GET(request());
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('"error":"x_credits_depleted"');
    expect(html).toContain('social_error=x_credits_depleted');
    expect(html).not.toContain('X API 402');
  });

  it('returns a popup-safe result when X credentials are unavailable', async () => {
    vi.stubEnv('X_CONSUMER_KEY', '');

    const response = await GET(request());
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('"error":"x_credentials_missing"');
    expect(html).toContain('social_error=x_credentials_missing');
  });
});