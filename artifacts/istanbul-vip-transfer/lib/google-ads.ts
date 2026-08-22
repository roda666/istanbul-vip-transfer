/**
 * Google Ads — Keyword Planner helper (server-only)
 *
 * Tokens are stored in `google_ads_connections` (single-row pattern, same as GSC).
 * All calls use the Google Ads REST API v18 — no npm client needed.
 *
 * API docs: https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas
 *
 * Security:
 *  • access_token / refresh_token are NEVER logged or returned to clients.
 *  • developer-token is read from GOOGLE_ADS_DEVELOPER_TOKEN env secret.
 *  • login-customer-id is read from GOOGLE_ADS_LOGIN_CUSTOMER_ID env secret.
 */
import 'server-only';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KeywordIdea {
  text: string;
  /** Average monthly searches (Turkey/Turkish) */
  avgMonthlySearches: number;
  /** 'LOW' | 'MEDIUM' | 'HIGH' */
  competition: string;
  /** Approximate bid range in USD (can be null if not available) */
  lowTopOfPageBidMicros: number | null;
  highTopOfPageBidMicros: number | null;
}

export interface KeywordPlanResult {
  ok: true;
  ideas: KeywordIdea[];
  dataSource: 'google_ads';
}

export interface KeywordPlanError {
  ok: false;
  reason: 'not_connected' | 'not_configured' | 'api_error' | 'token_refresh_failed';
  message: string;
}

// Turkey geoTargetConstant = 2792, Turkish languageConstant = 1011
const GEO_TARGET   = 'geoTargetConstants/2792';
const LANGUAGE     = 'languageConstants/1011';
const ADS_API_BASE = 'https://googleads.googleapis.com/v18';

// ── Token management ──────────────────────────────────────────────────────────

async function getRawConnection(): Promise<{
  access_token: string | null;
  refresh_token: string;
  connected: boolean;
  enabled: boolean;
  last_error: string | null;
  token_expiry: Date | null;
  connected_email: string | null;
} | null> {
  try {
    const { db } = await import('@/db');
    const result = await db.execute(
      `SELECT access_token, refresh_token, connected, enabled, last_error, token_expiry, connected_email
       FROM google_ads_connections ORDER BY id DESC LIMIT 1` as never
    ) as unknown as Array<{
      access_token: string | null; refresh_token: string;
      connected: boolean; enabled: boolean; last_error: string | null;
      token_expiry: Date | null; connected_email: string | null;
    }>;
    return (result as unknown as typeof result)[0] ?? null;
  } catch {
    return null;
  }
}

export async function isGoogleAdsConnected(): Promise<boolean> {
  const conn = await getRawConnection();
  return !!conn?.connected && !!conn.refresh_token;
}

export async function getGoogleAdsConnection(): Promise<{
  connectedEmail: string | null;
  connectedAt: Date | null;
  connected: boolean;
  enabled: boolean;
  lastError: string | null;
  updatedAt: Date;
} | null> {
  try {
    const { db } = await import('@/db');
    const result = await db.execute(
      `SELECT connected_email, connected_at, connected, enabled, last_error, updated_at
       FROM google_ads_connections ORDER BY id DESC LIMIT 1` as never
    ) as unknown as Array<{
      connected_email: string | null; connected_at: Date | null; connected: boolean;
      enabled: boolean; last_error: string | null; updated_at: Date;
    }>;
    const row = (result as unknown as typeof result)[0];
    if (!row) return null;
    return {
      connectedEmail: row.connected_email,
      connectedAt: row.connected_at,
      connected: row.connected,
      enabled: row.enabled,
      lastError: row.last_error,
      updatedAt: row.updated_at,
    };
  } catch { return null; }
}

/** Returns a valid access token, auto-refreshing if expired */
async function getAccessToken(): Promise<string | null> {
  const conn = await getRawConnection();
  if (!conn) return null;

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now    = new Date();
  const expiry = conn.token_expiry ? new Date(conn.token_expiry) : null;
  const needsRefresh = !conn.access_token || !expiry || expiry <= new Date(now.getTime() + 60_000);

  if (!needsRefresh && conn.access_token) return conn.access_token;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: conn.refresh_token,
        client_id:     clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) {
      console.error('[Google Ads] Token refresh failed:', res.status);
      return null;
    }
    const data = await res.json() as { access_token: string; expires_in: number };
    const newExpiry = new Date(Date.now() + data.expires_in * 1_000);

    const { db } = await import('@/db');
    await db.execute(
      `UPDATE google_ads_connections SET access_token = '${data.access_token}', token_expiry = '${newExpiry.toISOString()}', updated_at = NOW() WHERE id = (SELECT id FROM google_ads_connections ORDER BY id DESC LIMIT 1)` as never
    );

    return data.access_token;
  } catch (err) {
    console.error('[Google Ads] Token refresh error:', err instanceof Error ? err.message : 'unknown');
    return null;
  }
}

// ── Keyword Planner ───────────────────────────────────────────────────────────

/**
 * Generate keyword ideas for the given seed keywords.
 * Returns monthly search volumes and competition levels for Turkey/Turkish.
 *
 * @param seedKeywords  Up to 20 seed keywords (e.g. ['istanbul vip transfer'])
 * @param limit         Max ideas to return (default 20)
 */
export async function generateKeywordIdeas(
  seedKeywords: string[],
  limit = 20,
): Promise<KeywordPlanResult | KeywordPlanError> {
  const devToken      = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const loginCustId   = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (!devToken || !loginCustId) {
    return { ok: false, reason: 'not_configured', message: 'GOOGLE_ADS_DEVELOPER_TOKEN veya GOOGLE_ADS_LOGIN_CUSTOMER_ID eksik.' };
  }

  const conn = await getRawConnection();
  if (!conn) return { ok: false, reason: 'not_connected', message: 'Google Ads bağlı değil. Önce OAuth ile bağlanın.' };

  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false, reason: 'token_refresh_failed', message: 'Google Ads token yenileme başarısız.' };

  // Use the login customer as the "customer" for keyword planning (MCC account)
  const customerId = loginCustId.replace(/-/g, '');

  try {
    const res = await fetch(
      `${ADS_API_BASE}/customers/${customerId}:generateKeywordIdeas`,
      {
        method: 'POST',
        headers: {
          Authorization:     `Bearer ${accessToken}`,
          'developer-token': devToken,
          'login-customer-id': loginCustId,
          'Content-Type':    'application/json',
        },
        body: JSON.stringify({
          keywordSeed: { keywords: seedKeywords.slice(0, 20) },
          geoTargetConstants: [GEO_TARGET],
          language: LANGUAGE,
          keywordPlanNetwork: 'GOOGLE_SEARCH',
          includeAdultKeywords: false,
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      // Strip any token fragments from error before logging
      const safe = txt.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').slice(0, 400);
      console.error('[Google Ads] generateKeywordIdeas error:', res.status, safe);
      return { ok: false, reason: 'api_error', message: `API ${res.status}: ${safe}` };
    }

    const data = await res.json() as {
      results?: Array<{
        text?: string;
        keywordIdeaMetrics?: {
          avgMonthlySearches?: string;
          competition?: string;
          lowTopOfPageBidMicros?: string;
          highTopOfPageBidMicros?: string;
        };
      }>;
    };

    const ideas: KeywordIdea[] = (data.results ?? [])
      .slice(0, limit)
      .map(r => ({
        text:                  r.text ?? '',
        avgMonthlySearches:    parseInt(r.keywordIdeaMetrics?.avgMonthlySearches ?? '0', 10),
        competition:           r.keywordIdeaMetrics?.competition ?? 'UNKNOWN',
        lowTopOfPageBidMicros: r.keywordIdeaMetrics?.lowTopOfPageBidMicros
          ? parseInt(r.keywordIdeaMetrics.lowTopOfPageBidMicros, 10)
          : null,
        highTopOfPageBidMicros: r.keywordIdeaMetrics?.highTopOfPageBidMicros
          ? parseInt(r.keywordIdeaMetrics.highTopOfPageBidMicros, 10)
          : null,
      }))
      .filter(i => i.text && i.avgMonthlySearches > 0)
      .sort((a, b) => b.avgMonthlySearches - a.avgMonthlySearches);

    return { ok: true, ideas, dataSource: 'google_ads' };
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 300) : 'unknown';
    console.error('[Google Ads] generateKeywordIdeas exception:', msg);
    return { ok: false, reason: 'api_error', message: `Bağlantı hatası: ${msg}` };
  }
}

/**
 * Find the best keyword opportunity using Google Ads Keyword Planner data.
 * Picks the seed keyword with the highest monthly search volume
 * from a curated list of transfer-related seeds.
 */
export async function findKeywordOpportunitiesFromAds(limit = 5): Promise<{
  ok: true;
  opportunities: Array<{ keyword: string; monthlySearches: number; competition: string }>;
  dataSource: 'google_ads';
} | { ok: false; reason: string }> {
  // Curated seeds relevant to the business — not invented data
  const seeds = [
    'istanbul vip transfer',
    'istanbul havalimanı transfer',
    'sabiha gökçen transfer',
    'istanbul şehirlerarası transfer',
    'istanbul kurumsal transfer',
    'istanbul bodrum transfer',
    'istanbul ankara vip',
  ];

  const result = await generateKeywordIdeas(seeds, 30);
  if (!result.ok) return { ok: false, reason: result.message };

  // Top by search volume, deduplicated
  const seen = new Set<string>();
  const opportunities = result.ideas
    .filter(i => { if (seen.has(i.text)) return false; seen.add(i.text); return true; })
    .slice(0, limit)
    .map(i => ({ keyword: i.text, monthlySearches: i.avgMonthlySearches, competition: i.competition }));

  return { ok: true, opportunities, dataSource: 'google_ads' };
}

export async function disconnectGoogleAds(): Promise<void> {
  const { db } = await import('@/db');
  await db.execute(`DELETE FROM google_ads_connections` as never);
}
