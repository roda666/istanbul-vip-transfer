import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  gsc: vi.fn(),
  ads: vi.fn(),
  suggest: vi.fn(),
  insert: vi.fn(),
  capturedResearch: undefined as unknown,
  insertedSuggestion: undefined as unknown,
  insertCount: 0,
}));

vi.mock('@/lib/auth/session', () => ({ requireAdminSession: vi.fn(async () => ({ adminId: 'admin-1' })) }));
vi.mock('@/lib/gsc', () => ({ findKeywordOpportunities: mocks.gsc }));
vi.mock('@/lib/google-ads', () => ({ generateKeywordIdeas: mocks.ads }));
vi.mock('@/lib/ai/content-hub', () => ({ suggestTopicAndKeywords: mocks.suggest }));
vi.mock('@/db/schema', () => ({ aiContentSuggestions: {}, auditLogs: {} }));
vi.mock('@/db', () => ({
  db: {
    insert: mocks.insert,
  },
}));

const { POST } = await import('@/app/admin/api/ai-content/suggest/route');

const gscRow = { query: 'istanbul vip transfer', clicks: 2, impressions: 200, ctr: 0.01, position: 14, reason: 'low_ctr', score: 1 };
const adsIdea = { text: 'Sabiha Gökçen VIP transfer', avgMonthlySearches: 900, competition: 'MEDIUM', lowTopOfPageBidMicros: null, highTopOfPageBidMicros: null };
const duplicateAdsIdea = { ...adsIdea, text: 'İstanbul VIP Transfer' };

function request() {
  return new NextRequest('http://localhost/admin/api/ai-content/suggest', {
    method: 'POST',
    body: JSON.stringify({ articleType: 'Rehber', targetService: 'VIP transfer', targetLocation: 'İstanbul' }),
    headers: { 'content-type': 'application/json' },
  });
}

describe('AI content suggestion discovery route', () => {
  beforeEach(() => {
    mocks.gsc.mockReset();
    mocks.ads.mockReset();
    mocks.suggest.mockReset();
    mocks.insertCount = 0;
    mocks.capturedResearch = undefined;
    mocks.insertedSuggestion = undefined;
    mocks.suggest.mockImplementation(async (input: { searchResearch: unknown }) => {
      mocks.capturedResearch = input.searchResearch;
      return { ok: true, model: 'test', data: {
        title: 'Başlık', primaryKeyword: 'anahtar kelime', supportingKeywords: [],
        searchIntent: 'Informational', contentSummary: 'Özet', suggestedH2s: [], estimatedWordCount: 1000, dataSourceNote: 'not',
      } };
    });
    mocks.insert.mockImplementation(() => {
      mocks.insertCount += 1;
      if (mocks.insertCount === 1) {
        return { values: (value: unknown) => {
          mocks.insertedSuggestion = value;
          return { returning: async () => [{ id: 'suggestion-1' }] };
        } };
      }
      return { values: () => ({ catch: () => undefined }) };
    });
  });

  it('keeps both fulfilled providers as independent persisted groups and removes duplicate Ads ideas', async () => {
    mocks.gsc.mockResolvedValue({ ok: true, opportunities: [gscRow] });
    mocks.ads.mockResolvedValue([duplicateAdsIdea, adsIdea]);
    await POST(request());
    expect(mocks.gsc).toHaveBeenCalledWith(20);
    expect(mocks.ads).toHaveBeenCalledWith(['VIP transfer', 'İstanbul', 'İstanbul VIP transfer'], 20);
    expect(mocks.capturedResearch).toMatchObject({
      source: 'combined',
      sourceState: { gsc: 'usable', googleAds: 'usable' },
      sourceGroups: {
        gsc: { label: 'nearby_gains', provenance: 'actual_site_queries' },
        googleAds: { label: 'new_market_opportunities', provenance: 'keyword_planner_market_data' },
      },
      gscRows: [{ query: 'istanbul vip transfer' }],
      adsRows: [{ keyword: 'Sabiha Gökçen VIP transfer' }],
    });
    expect(mocks.insertedSuggestion).toMatchObject({
      suggestedKeywordsJson: { searchResearch: { source: 'combined', adsRows: [{ keyword: 'Sabiha Gökçen VIP transfer' }] } },
    });
  });

  it('persists Ads-only discovery when GSC rejects', async () => {
    mocks.gsc.mockRejectedValue(new Error('provider detail must not persist'));
    mocks.ads.mockResolvedValue([adsIdea]);
    await POST(request());
    expect(mocks.capturedResearch).toMatchObject({ source: 'google_ads', sourceState: { gsc: 'unavailable:unexpected_error', googleAds: 'usable' } });
  });

  it('persists GSC-only discovery when Ads rejects', async () => {
    mocks.gsc.mockResolvedValue({ ok: true, opportunities: [gscRow] });
    mocks.ads.mockRejectedValue(new Error('provider detail must not persist'));
    await POST(request());
    expect(mocks.capturedResearch).toMatchObject({ source: 'gsc', sourceState: { gsc: 'usable', googleAds: 'unavailable:api_or_connection_error' } });
  });

  it('persists safe no-data state when both providers reject', async () => {
    mocks.gsc.mockRejectedValue(new Error('gsc detail'));
    mocks.ads.mockRejectedValue(new Error('ads detail'));
    await POST(request());
    expect(mocks.capturedResearch).toMatchObject({
      source: 'none',
      sourceState: { gsc: 'unavailable:unexpected_error', googleAds: 'unavailable:api_or_connection_error' },
      sourceGroups: expect.any(Object),
    });
    expect(JSON.stringify(mocks.capturedResearch)).not.toContain('detail');
  });
});