/**
 * Google Search Console API helper.
 * Tokens are stored in the `gsc_connections` DB table (id=1, single-row pattern).
 * All API calls use the official Search Analytics endpoint.
 *
 * Security: access_token and refresh_token are NEVER logged or returned to clients.
 */
import 'server-only';
import { sql } from 'drizzle-orm';
import { resolveIntegrationSecret } from '@/lib/integration-secrets';

export interface GscConnection {
  siteUrl: string;
  connectedEmail: string | null;
  connectedAt: Date;
  connected: boolean;
  enabled: boolean;
  lastError: string | null;
  updatedAt: Date;
}

export type GscAvailabilityReason = 'gsc_reconnect_required' | 'token_refresh_failed';

/**
 * Classifies the safe, documented portion of an OAuth token error.  Callers
 * must pass only the parsed error fields; never log or return the response
 * body because it can contain credentials or provider diagnostics.
 */
export function classifyGscTokenEndpointFailure(
  status: number,
  payload: unknown,
): GscAvailabilityReason {
  const error = payload && typeof payload === 'object'
    ? (payload as { error?: unknown }).error
    : undefined;
  if ((status === 400 && (error === 'invalid_grant' || error === 'invalid_client'))
    || (status === 401 && error === 'invalid_client')) {
    return 'gsc_reconnect_required';
  }
  return 'token_refresh_failed';
}

export interface SearchRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;      // 0–1
  position: number; // avg position (1 = top)
}

export interface PageSearchRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PageAnalyticsOptions {
  startDate: string;
  endDate: string;
  limit?: number;
}

const PAGE_ANALYTICS_MIN_LIMIT = 1;
const PAGE_ANALYTICS_MAX_LIMIT = 1_000;
const PAGE_ANALYTICS_MAX_RANGE_DAYS = 366;

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

/** Validates untrusted page-analytics request inputs before they reach Google. */
export function validatePageAnalyticsOptions(opts: PageAnalyticsOptions):
  | { ok: true; startDate: string; endDate: string; limit: number }
  | { ok: false; reason: 'invalid_date_range' | 'invalid_limit' } {
  const start = parseIsoDate(opts.startDate);
  const end = parseIsoDate(opts.endDate);
  const limit = opts.limit ?? 100;
  if (!start || !end || start > end ||
    end.getTime() - start.getTime() > PAGE_ANALYTICS_MAX_RANGE_DAYS * 86_400_000) {
    return { ok: false, reason: 'invalid_date_range' };
  }
  if (!Number.isInteger(limit) || limit < PAGE_ANALYTICS_MIN_LIMIT || limit > PAGE_ANALYTICS_MAX_LIMIT) {
    return { ok: false, reason: 'invalid_limit' };
  }
  return { ok: true, startDate: opts.startDate, endDate: opts.endDate, limit };
}

export interface KeywordOpportunity {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  /** Why this query is an opportunity */
  reason: 'low_ctr' | 'low_position' | 'high_impression_gap';
  score: number; // higher = better opportunity
}

// ── Token management ──────────────────────────────────────────────────────────

async function getRawConnection(): Promise<{
  site_url: string;
  access_token: string | null;
  refresh_token: string;
  connected: boolean;
  enabled: boolean;
  last_error: string | null;
  token_expiry: Date | null;
  connected_email: string | null;
  connected_at: Date;
  updated_at: Date;
} | null> {
  try {
    const { db } = await import('@/db');
    const result = await db.execute(
      `SELECT site_url, access_token, refresh_token, connected, enabled, last_error,
              token_expiry, connected_email, connected_at, updated_at
       FROM gsc_connections ORDER BY id DESC LIMIT 1` as never
    ) as unknown as Array<{
      site_url: string; access_token: string | null; refresh_token: string;
      connected: boolean; enabled: boolean; last_error: string | null;
      token_expiry: Date | null; connected_email: string | null; connected_at: Date; updated_at: Date;
    }>;
    return (result as unknown as typeof result)[0] ?? null;
  } catch {
    return null;
  }
}

/** Returns true if GSC tokens are stored in the DB */
export async function isGscConnected(): Promise<boolean> {
  const conn = await getRawConnection();
  return !!conn?.connected && !!conn.enabled && !!conn.refresh_token
    && conn.last_error !== 'gsc_reconnect_required';
}

/** Returns public connection info (no tokens) */
export async function getGscConnection(): Promise<GscConnection | null> {
  const conn = await getRawConnection();
  if (!conn) return null;
  return {
    siteUrl: conn.site_url,
    connectedEmail: conn.connected_email,
    connectedAt: conn.connected_at,
    connected: conn.connected,
    enabled: conn.enabled,
    lastError: conn.last_error,
    updatedAt: conn.updated_at,
  };
}

/** Returns a valid access token, refreshing if necessary */
async function persistTokenFailure(reason: GscAvailabilityReason): Promise<void> {
  try {
    const { db } = await import('@/db');
    const { gscConnections } = await import('@/db/schema');
    await db.update(gscConnections).set({
      lastError: reason,
      ...(reason === 'gsc_reconnect_required' ? { connected: false, enabled: false } : {}),
      updatedAt: new Date(),
    }).where(sql`${gscConnections.id} = (SELECT id FROM gsc_connections ORDER BY id DESC LIMIT 1)`);
  } catch {
    // A provider failure must never turn into a credential-bearing error.
  }
}

async function getAccessToken(): Promise<
  { token: string } | { failure: GscAvailabilityReason } | null
> {
  const conn = await getRawConnection();
  if (!conn) return null;
  if (!conn.connected || !conn.enabled || conn.last_error === 'gsc_reconnect_required') {
    return { failure: 'gsc_reconnect_required' };
  }

  const clientId = await resolveIntegrationSecret('GOOGLE_CLIENT_ID');
  const clientSecret = await resolveIntegrationSecret('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return { failure: 'token_refresh_failed' };

  const now = new Date();
  const expiry = conn.token_expiry ? new Date(conn.token_expiry) : null;
  const needsRefresh = !conn.access_token || !expiry || expiry <= new Date(now.getTime() + 60_000);

  if (!needsRefresh && conn.access_token) return { token: conn.access_token };

  // Refresh
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
      let payload: unknown = null;
      try { payload = await res.json(); } catch { /* classified as transient */ }
      const reason = classifyGscTokenEndpointFailure(res.status, payload);
      await persistTokenFailure(reason);
      return { failure: reason };
    }
    const data = await res.json() as { access_token?: unknown; expires_in?: unknown };
    if (typeof data.access_token !== 'string' || !data.access_token
      || typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in)) {
      await persistTokenFailure('token_refresh_failed');
      return { failure: 'token_refresh_failed' };
    }
    const newExpiry = new Date(Date.now() + data.expires_in * 1000);

    // Update DB
    const { db } = await import('@/db');
    const { gscConnections } = await import('@/db/schema');
    await db.update(gscConnections)
      .set({ accessToken: data.access_token, tokenExpiry: newExpiry, lastError: null, updatedAt: new Date() })
      .where(sql`${gscConnections.id} = (SELECT id FROM gsc_connections ORDER BY id DESC LIMIT 1)`);

    return { token: data.access_token };
  } catch {
    await persistTokenFailure('token_refresh_failed');
    return { failure: 'token_refresh_failed' };
  }
}

/**
 * Fetches Search Console performance grouped by page. Inputs are deliberately
 * explicit (rather than relative days) so admin reporting is reproducible.
 */
export async function fetchPageSearchAnalytics(opts: PageAnalyticsOptions): Promise<
  { ok: true; rows: PageSearchRow[] } |
  { ok: false; reason: 'invalid_date_range' | 'invalid_limit' | 'not_connected' | 'gsc_reconnect_required' | 'token_refresh_failed' | 'api_error' | 'fetch_error' }
> {
  const validated = validatePageAnalyticsOptions(opts);
  if (!validated.ok) return validated;
  const conn = await getRawConnection();
  if (!conn) return { ok: false, reason: 'not_connected' };
  const tokenResult = await getAccessToken();
  if (!tokenResult) return { ok: false, reason: 'token_refresh_failed' };
  if ('failure' in tokenResult) return { ok: false, reason: tokenResult.failure };
  const token = tokenResult.token;

  try {
    const siteUrl = encodeURIComponent(conn.site_url);
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: validated.startDate,
        endDate: validated.endDate,
        dimensions: ['page'],
        rowLimit: validated.limit,
        startRow: 0,
        searchType: 'web',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, reason: 'api_error' };
    const data = await res.json() as {
      rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>;
    };
    return {
      ok: true,
      rows: (data.rows ?? []).map(row => ({
        page: row.keys[0] ?? '',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
    };
  } catch {
    return { ok: false, reason: 'fetch_error' };
  }
}

// ── Search Analytics ──────────────────────────────────────────────────────────

/**
 * Fetch top queries from Search Console for the last N days.
 * Returns up to `limit` rows ordered by impressions desc.
 */
export async function fetchSearchAnalytics(opts?: {
  days?: number;
  limit?: number;
  rowLimit?: number;
}): Promise<{ ok: true; rows: SearchRow[] } | { ok: false; reason: string }> {
  const conn = await getRawConnection();
  if (!conn) return { ok: false, reason: 'not_connected' };

  const tokenResult = await getAccessToken();
  if (!tokenResult) return { ok: false, reason: 'token_refresh_failed' };
  if ('failure' in tokenResult) return { ok: false, reason: tokenResult.failure };
  const token = tokenResult.token;

  const days = opts?.days ?? 90;
  const rowLimit = opts?.rowLimit ?? 500;
  const endDate  = new Date();
  const startDate = new Date(endDate.getTime() - days * 86_400_000);
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const siteUrl = encodeURIComponent(conn.site_url);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate:   fmt(startDate),
        endDate:     fmt(endDate),
        dimensions:  ['query'],
        rowLimit,
        startRow:    0,
        searchType:  'web',
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return { ok: false, reason: 'api_error' };

    const data = await res.json() as {
      rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>;
    };
    const rows: SearchRow[] = (data.rows ?? []).map(r => ({
      query:       r.keys[0] ?? '',
      clicks:      r.clicks,
      impressions: r.impressions,
      ctr:         r.ctr,
      position:    r.position,
    }));

    return { ok: true, rows };
  } catch {
    return { ok: false, reason: 'fetch_error' };
  }
}

/**
 * Find the best keyword content opportunity from GSC data.
 * Heuristic: high impressions + low CTR (< 5%) = content gap.
 * Returns top opportunities sorted by score (impressions × (1 - ctr)).
 */
export async function findKeywordOpportunities(limit = 10): Promise<{
  ok: true;
  opportunities: KeywordOpportunity[];
  dataSource: 'gsc';
} | {
  ok: false;
  reason: string;
}> {
  const result = await fetchSearchAnalytics({ days: 90, rowLimit: 500 });
  if (!result.ok) return { ok: false, reason: result.reason };

  const opportunities: KeywordOpportunity[] = result.rows
    .filter(r => r.impressions >= 50) // ignore tiny-volume queries
    .map(r => {
      let reason: KeywordOpportunity['reason'] = 'high_impression_gap';
      let score = 0;

      if (r.ctr < 0.03 && r.impressions >= 100) {
        reason = 'low_ctr';
        score = r.impressions * (1 - r.ctr) * 2;
      } else if (r.position > 10 && r.impressions >= 50) {
        reason = 'low_position';
        score = r.impressions * (r.position / 10);
      } else {
        score = r.impressions * (1 - r.ctr);
      }

      return { ...r, reason, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { ok: true, opportunities, dataSource: 'gsc' };
}

/** Disconnect by deleting all rows from gsc_connections */
export async function disconnectGsc(): Promise<void> {
  const { db } = await import('@/db');
  await db.execute(`DELETE FROM gsc_connections` as never);
}
