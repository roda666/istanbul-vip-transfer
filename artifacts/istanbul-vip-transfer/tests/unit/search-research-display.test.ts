import { describe, expect, it } from 'vitest';
import { searchResearchDisplay, type SearchResearchPayload } from '@/lib/search-research';

const gscRow = { query: 'istanbul vip transfer', clicks: 1, impressions: 100, ctr: 0.01, position: 12 };
const adsRow = { keyword: 'sabiha gökçen transfer', monthlySearches: 500, competition: 'MEDIUM' };

function payload(overrides: Partial<SearchResearchPayload>): SearchResearchPayload {
  return {
    source: 'none',
    fetchedAt: '2026-01-01T00:00:00.000Z',
    sourceState: { gsc: 'not_checked', googleAds: 'not_checked' },
    ...overrides,
  };
}

describe('admin research group rendering model', () => {
  it('shows both Turkish source groups and provenance badges for combined research', () => {
    const view = searchResearchDisplay(payload({
      source: 'combined',
      sourceState: { gsc: 'usable', googleAds: 'usable' },
      gscRows: [gscRow],
      adsRows: [adsRow],
    }));
    expect(view).toMatchObject({
      showGsc: true, showAds: true,
      gscHeading: 'Yakındaki kazançlar', adsHeading: 'Yeni pazar fırsatları',
      gscBadge: 'GSC · gerçek site sorguları', adsBadge: 'Google Ads · pazar verisi',
    });
  });

  it('does not render a group heading for no-data or legacy research', () => {
    expect(searchResearchDisplay(payload({
      sourceState: { gsc: 'unavailable:provider-response-with-secret', googleAds: 'no_usable_rows' },
    }))).toMatchObject({ showGsc: false, showAds: false });
    expect(searchResearchDisplay(undefined)).toMatchObject({ showGsc: false, showAds: false });
  });

  it('converts unavailable states to safe UI wording without provider diagnostics', () => {
    const view = searchResearchDisplay(payload({
      sourceState: { gsc: 'unavailable:API 500 secret-body', googleAds: 'unavailable:token-123' },
    }));
    expect(view.stateText).toBe('Search Console: kullanılamıyor · Google Ads: kullanılamıyor');
    expect(view.stateText).not.toContain('secret');
    expect(view.stateText).not.toContain('token');
  });
});