/** Search research shapes and pure selection helpers. No credentials or API calls. */
export type SearchResearchSource = 'gsc' | 'google_ads' | 'combined' | 'none';

export interface GscResearchRow {
  query: string; clicks: number; impressions: number; ctr: number; position: number;
  opportunity?: 'weak_ranking';
  isQuestion?: boolean;
}
export interface AdsResearchRow {
  keyword: string; monthlySearches: number; competition: string;
}
export interface SearchResearchSourceGroups {
  gsc: { label: 'nearby_gains'; provenance: 'actual_site_queries' };
  googleAds: { label: 'new_market_opportunities'; provenance: 'keyword_planner_market_data' };
}
export interface SearchResearchPayload {
  source: SearchResearchSource;
  fetchedAt: string;
  gscRows?: GscResearchRow[];
  adsRows?: AdsResearchRow[];
  /** Observable, non-secret connection/API state. */
  sourceState: { gsc: string; googleAds: string };
  /** Stable, persisted meaning for each independently collected source group. */
  sourceGroups?: SearchResearchSourceGroups;
}

/** Presentation-safe research labels: provider diagnostic values never reach UI text. */
export function searchResearchDisplay(payload?: SearchResearchPayload): {
  showGsc: boolean;
  showAds: boolean;
  gscHeading: string;
  adsHeading: string;
  gscBadge: string;
  adsBadge: string;
  stateText: string;
} {
  const showGsc = Boolean(payload?.gscRows?.length);
  const showAds = Boolean(payload?.adsRows?.length);
  const safeState = (state: string | undefined) =>
    state?.startsWith('unavailable:') ? 'kullanılamıyor' :
      state === 'usable' ? 'kullanılabilir' :
        state === 'no_usable_rows' ? 'uygun satır yok' : 'kontrol edilmedi';
  return {
    showGsc,
    showAds,
    gscHeading: 'Yakındaki kazançlar',
    adsHeading: 'Yeni pazar fırsatları',
    gscBadge: 'GSC · gerçek site sorguları',
    adsBadge: 'Google Ads · pazar verisi',
    stateText: `Search Console: ${safeState(payload?.sourceState.gsc)} · Google Ads: ${safeState(payload?.sourceState.googleAds)}`,
  };
}

export function normalizeResearchKeyword(value: string): string {
  return value
    // Decompose first so İ becomes I + combining dot, then treat all Turkish
    // I variants as one canonical character before a locale-independent case fold.
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[İIı]/g, 'i')
    .replace(/[\p{P}\p{S}_]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Ads ideas describe new market opportunities only. A normalized GSC query
 * already represents an actual site query and must not be duplicated as Ads.
 */
export function excludeAdsIdeasRepresentedInGsc(
  adsRows: AdsResearchRow[],
  gscRows: GscResearchRow[],
): AdsResearchRow[] {
  const gscKeywords = new Set(gscRows.map(row => normalizeResearchKeyword(row.query)).filter(Boolean));
  const seen = new Set<string>();
  return adsRows.filter(row => {
    const normalized = normalizeResearchKeyword(row.keyword);
    if (!normalized || gscKeywords.has(normalized) || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

const TURKISH_QUESTION_WORDS = /(?:^|\s)(?:ne(?:dir|den)?|nasıl|neden|niçin|nerede|nereye|nereden|hangi|hangisi|kaç|kim|kimin|mı|mi|mu|mü)\b/i;

/** Conservative: a question mark, or an explicit Turkish interrogative word. */
export function isQuestionShapedQuery(value: string): boolean {
  const query = value.replace(/\s+/g, ' ').trim();
  if (query.length < 3 || query.length > 180) return false;
  return query.endsWith('?') || TURKISH_QUESTION_WORDS.test(query);
}

export function sanitizeResearchSeeds(values: string[]): string[] {
  const seen = new Set<string>();
  return values.flatMap(value => {
    const seed = value.replace(/[\u0000-\u001F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    const key = seed.toLocaleLowerCase('tr-TR');
    if (!seed || seen.has(key)) return [];
    seen.add(key);
    return [seed];
  }).slice(0, 20);
}

/** Existing queries with visibility but page-two-or-lower placement or a weak CTR. */
export function classifyGscResearchRows(rows: GscResearchRow[], limit = 20): GscResearchRow[] {
  return rows
    .filter(r => typeof r.query === 'string' && r.query.trim() && Number.isFinite(r.clicks) && Number.isFinite(r.impressions) &&
      Number.isFinite(r.ctr) && Number.isFinite(r.position) && r.impressions > 0)
    .map(r => ({
      ...r,
      query: r.query.replace(/\s+/g, ' ').trim().slice(0, 180),
      opportunity: r.impressions >= 50 && (r.position > 10 || r.ctr < 0.03) ? 'weak_ranking' as const : undefined,
      isQuestion: isQuestionShapedQuery(r.query),
    }))
    .sort((a, b) => {
      const aWeak = a.opportunity === 'weak_ranking' ? 1 : 0;
      const bWeak = b.opportunity === 'weak_ranking' ? 1 : 0;
      return bWeak - aWeak || (b.impressions * (1 - b.ctr)) - (a.impressions * (1 - a.ctr));
    })
    .slice(0, limit);
}

export function dataSourceNote(source: SearchResearchSource): string {
  if (source === 'combined') return 'Google Search Console yakın kazanımları ve Google Ads Keyword Planner yeni pazar fırsatları birlikte kullanıldı.';
  if (source === 'gsc') return 'Google Search Console canlı sorgu performans verisi kullanıldı.';
  if (source === 'google_ads') return 'Google Ads Keyword Planner canlı anahtar kelime fikirleri kullanıldı.';
  return 'Bağlı kullanılabilir arama verisi yok; hacim, rekabet veya sıralama metriği kullanılmadı.';
}