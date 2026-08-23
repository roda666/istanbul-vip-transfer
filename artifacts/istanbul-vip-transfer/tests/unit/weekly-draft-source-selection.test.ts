import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  gscConnected: vi.fn(),
  gscOpportunities: vi.fn(),
  adsConnected: vi.fn(),
  adsOpportunities: vi.fn(),
}));

vi.mock('@/lib/gsc', () => ({
  isGscConnected: mocks.gscConnected,
  findKeywordOpportunities: mocks.gscOpportunities,
}));
vi.mock('@/lib/google-ads', () => ({
  isGoogleAdsConnected: mocks.adsConnected,
  findKeywordOpportunitiesFromAds: mocks.adsOpportunities,
}));

const { selectAutomaticTopic } = await import('@/app/admin/api/cron/weekly-draft/route');

describe('weekly draft source labelling', () => {
  beforeEach(() => {
    mocks.gscConnected.mockReset();
    mocks.gscOpportunities.mockReset();
    mocks.adsConnected.mockReset();
    mocks.adsOpportunities.mockReset();
  });

  it('labels an Ads fallback topic as google_ads rather than AI estimation', async () => {
    mocks.gscConnected.mockResolvedValue(true);
    mocks.gscOpportunities.mockResolvedValue({ ok: true, opportunities: [] });
    mocks.adsConnected.mockResolvedValue(true);
    mocks.adsOpportunities.mockResolvedValue([{ keyword: 'istanbul transfer', monthlySearches: 100, competition: 'MEDIUM' }]);
    await expect(selectAutomaticTopic(0)).resolves.toMatchObject({
      source: 'google_ads',
      primaryKeyword: 'istanbul transfer',
    });
  });
});