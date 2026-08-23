import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { classifyXOAuthFailure, getSocialOAuthMessage, getSocialPlatformLastErrorMessage } from '@/lib/social-oauth-feedback';
import { socialOAuthCallbackResponse } from '@/lib/social-oauth-callback';

describe('social OAuth feedback', () => {
  it('maps X credit exhaustion to an actionable, safe error code and message', () => {
    const code = classifyXOAuthFailure(new Error('X API 402: credits depleted'));

    expect(code).toBe('x_credits_depleted');
    expect(getSocialOAuthMessage(code)).toContain('X Developer Portal');
    expect(getSocialOAuthMessage(code)).not.toContain('402');
    expect(getSocialOAuthMessage(code)).toContain('X API kredisi gerekiyor');
  });

  it('recognizes structured X API payment-required errors without exposing provider details', () => {
    expect(classifyXOAuthFailure({ status: 402, error: { detail: 'upstream details' } })).toBe('x_credits_depleted');
    expect(classifyXOAuthFailure({
      response: { status: 402, data: { errors: [{ message: 'request was rejected' }] } },
    })).toBe('x_credits_depleted');
  });

  it('keeps unknown provider failures generic and safe', () => {
    expect(classifyXOAuthFailure(new Error('unexpected upstream error'))).toBe('x_request_token_failed');
    expect(getSocialOAuthMessage('x_request_token_failed')).not.toContain('unexpected upstream error');
  });

  it('turns persisted provider errors into safe dashboard copy', () => {
    const message = getSocialPlatformLastErrorMessage(
      'x',
      'X API 402: {"detail":"credits depleted","status":402}',
    );

    expect(message).toContain('X Developer Portal');
    expect(message).not.toContain('402');
    expect(message).not.toContain('detail');
  });

  it('renders an error callback page without exposing its internal code as visible copy', async () => {
    const request = new NextRequest('https://preview.example/admin/api/social-platforms/x/connect', {
      headers: { 'x-forwarded-host': 'preview.example' },
    });
    const response = socialOAuthCallbackResponse(
      request,
      { provider: 'x', success: false, error: 'x_credits_depleted' },
      'https://preview.example/admin/ayarlar/icerik-entegrasyonlari?social_error=x_credits_depleted',
    );
    const html = await response.text();

    expect(html).toContain('<title>Bağlantı tamamlanamadı</title>');
    expect(html).toContain('Bağlantı tamamlanamadı. Bu pencere kapanıyor…');
    expect(html).toContain('social_error=x_credits_depleted');
  });
});