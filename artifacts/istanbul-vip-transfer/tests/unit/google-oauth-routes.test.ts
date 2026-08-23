import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  dbExecute: vi.fn(),
  dbUpdate: vi.fn(),
  dbDelete: vi.fn(),
  dbInsert: vi.fn(),
  dbValues: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock('@/db', () => ({
  db: {
    execute: mocks.dbExecute,
    update: mocks.dbUpdate,
    delete: mocks.dbDelete,
    insert: mocks.dbInsert,
  },
}));

vi.mock('@/db/schema', () => ({
  gscConnections: {},
  googleAdsConnections: {},
}));

import { GET as startGscConnect } from '@/app/admin/api/gsc/connect/route';
import { GET as handleGscCallback } from '@/app/admin/api/gsc/callback/route';
import { GET as startGoogleAdsConnect } from '@/app/admin/api/google-ads/connect/route';
import { GET as handleGoogleAdsCallback } from '@/app/admin/api/google-ads/callback/route';

const APP_ORIGIN = 'https://preview.example';

function request(path: string, headers?: Record<string, string>) {
  return new NextRequest(`${APP_ORIGIN}${path}`, { headers });
}

function callbackRequest(path: string, cookie: string) {
  return new NextRequest(`${APP_ORIGIN}${path}`, {
    headers: { cookie },
  });
}

describe('Google OAuth routes', () => {
  beforeEach(() => {
    mocks.requireAdminSession.mockReset();
    mocks.requireAdminSession.mockResolvedValue({ isLoggedIn: true, role: 'ADMIN' });
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
    mocks.dbExecute.mockReset();
    mocks.dbUpdate.mockReset();
    mocks.dbDelete.mockReset();
    mocks.dbInsert.mockReset();
    mocks.dbValues.mockReset();
    mocks.dbDelete.mockResolvedValue(undefined);
    mocks.dbInsert.mockReturnValue({ values: mocks.dbValues });
    mocks.dbValues.mockResolvedValue(undefined);
    mocks.fetch.mockReset();
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('starts Search Console OAuth with the registered callback and readonly scope', async () => {
    const response = await startGscConnect(request('/admin/api/gsc/connect', {
      host: '0.0.0.0:26004',
      'x-forwarded-host': 'preview.example',
    }));
    const redirect = new URL(response.headers.get('location')!);

    expect(response.status).toBe(307);
    expect(redirect.origin + redirect.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(redirect.searchParams.get('redirect_uri')).toBe('https://www.istanbulviptransfer.com/admin/api/gsc/callback');
    expect(redirect.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/webmasters.readonly');
    expect(redirect.searchParams.get('prompt')).toBe('consent');
    expect(response.headers.get('set-cookie')).toContain('gsc_oauth_state=');
  });

  it('starts Google Ads OAuth with the registered callback and Keyword Planner scope', async () => {
    const response = await startGoogleAdsConnect(request('/admin/api/google-ads/connect', {
      host: '0.0.0.0:26004',
      'x-forwarded-host': 'preview.example',
    }));
    const redirect = new URL(response.headers.get('location')!);

    expect(response.status).toBe(307);
    expect(redirect.searchParams.get('redirect_uri')).toBe('https://www.istanbulviptransfer.com/admin/api/google-ads/callback');
    expect(redirect.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/adwords');
    expect(redirect.searchParams.get('prompt')).toBe('consent');
    expect(response.headers.get('set-cookie')).toContain('gads_oauth_state=');
  });

  it('rejects invalid state before either callback can exchange a code', async () => {
    const [gscResponse, adsResponse] = await Promise.all([
      handleGscCallback(request('/admin/api/gsc/callback?code=code&state=bad-state')),
      handleGoogleAdsCallback(request('/admin/api/google-ads/callback?code=code&state=bad-state')),
    ]);

    expect(new URL(gscResponse.headers.get('location')!).searchParams.get('error')).toBe('invalid_state');
    expect(new URL(adsResponse.headers.get('location')!).searchParams.get('error')).toBe('gads_invalid_state');
  });

  it('maps cancellation to safe, user-facing callback results', async () => {
    const [gscResponse, adsResponse] = await Promise.all([
      handleGscCallback(request('/admin/api/gsc/callback?error=access_denied')),
      handleGoogleAdsCallback(request('/admin/api/google-ads/callback?error=access_denied')),
    ]);

    expect(new URL(gscResponse.headers.get('location')!).searchParams.get('error')).toBe('user_cancelled');
    expect(new URL(adsResponse.headers.get('location')!).searchParams.get('error')).toBe('gads_user_cancelled');
  });

  it('writes active GSC status and redirects to success after a valid callback', async () => {
    const state = Buffer.from(JSON.stringify({
      ts: Date.now(),
      nonce: 'a'.repeat(43),
    })).toString('base64url');
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: 'admin@example.com' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        siteEntry: [{ siteUrl: 'https://www.istanbulviptransfer.com/', permissionLevel: 'siteOwner' }],
      })));

    const response = await handleGscCallback(callbackRequest(
      `/admin/api/gsc/callback?code=test-code&state=${state}`,
      `gsc_oauth_state=${state}; gsc_redirect_uri=https://www.istanbulviptransfer.com/admin/api/gsc/callback`,
    ));

    expect(new URL(response.headers.get('location')!).searchParams.get('success')).toBe('gsc_connected');
    expect(mocks.dbDelete).toHaveBeenCalledTimes(1);
    expect(mocks.dbValues).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      connected: true,
      enabled: true,
    }));
    expect(String(mocks.dbValues.mock.calls[0]?.[0])).not.toContain("'");
  });

  it('writes active Google Ads status and redirects to success after a valid callback', async () => {
    const state = Buffer.from(JSON.stringify({
      ts: Date.now(),
      svc: 'google_ads',
      nonce: 'a'.repeat(43),
    })).toString('base64url');
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/adwords',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: 'admin@example.com' })));

    const response = await handleGoogleAdsCallback(callbackRequest(
      `/admin/api/google-ads/callback?code=test-code&state=${state}`,
      `gads_oauth_state=${state}; gads_redirect_uri=https://www.istanbulviptransfer.com/admin/api/google-ads/callback`,
    ));

    expect(new URL(response.headers.get('location')!).searchParams.get('success')).toBe('gads_connected');
    expect(mocks.dbDelete).toHaveBeenCalledTimes(1);
    expect(mocks.dbValues).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      connected: true,
      enabled: true,
    }));
  });
});