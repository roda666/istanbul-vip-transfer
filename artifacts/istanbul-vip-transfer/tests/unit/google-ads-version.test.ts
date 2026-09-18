import { afterEach, describe, expect, it } from 'vitest';
import { getGoogleAdsApiBase, getGoogleAdsApiVersion, normalizeGoogleAdsCustomerId } from '@/lib/google-ads';

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

  it('normalizes valid MCC and target customer IDs independently', () => {
    expect(normalizeGoogleAdsCustomerId('477-406-2070')).toBe('4774062070');
    expect(normalizeGoogleAdsCustomerId('2492938833')).toBe('2492938833');
    expect(normalizeGoogleAdsCustomerId('not-a-customer')).toBeNull();
  });
});