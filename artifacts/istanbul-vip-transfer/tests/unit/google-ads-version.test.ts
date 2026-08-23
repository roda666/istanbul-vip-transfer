import { afterEach, describe, expect, it } from 'vitest';
import { getGoogleAdsApiBase, getGoogleAdsApiVersion } from '@/lib/google-ads';

const originalVersion = process.env.GOOGLE_ADS_API_VERSION;

afterEach(() => {
  if (originalVersion === undefined) delete process.env.GOOGLE_ADS_API_VERSION;
  else process.env.GOOGLE_ADS_API_VERSION = originalVersion;
});

describe('Google Ads Keyword Planner endpoint', () => {
  it('uses maintained v24 by default', () => {
    delete process.env.GOOGLE_ADS_API_VERSION;
    expect(getGoogleAdsApiVersion()).toBe('v24');
    expect(getGoogleAdsApiBase()).toBe('https://googleads.googleapis.com/v24');
  });

  it('allows only a version segment as configuration', () => {
    process.env.GOOGLE_ADS_API_VERSION = 'v25';
    expect(getGoogleAdsApiBase()).toBe('https://googleads.googleapis.com/v25');
    process.env.GOOGLE_ADS_API_VERSION = 'v24/unsafe';
    expect(getGoogleAdsApiVersion()).toBe('v24');
  });
});