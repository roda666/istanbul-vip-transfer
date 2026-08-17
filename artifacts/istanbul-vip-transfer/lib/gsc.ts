/**
 * Google Search Console API helper.
 * Tokens are stored in the `gsc_connections` DB table (id=1, single-row pattern).
 * All API calls use the official Search Analytics endpoint.
 *
 * Security: access_token and refresh_token are NEVER logged or returned to clients.
 */
import 'server-only';

export interface GscConnection {
  siteUrl: string;
  connectedEmail: string | null;
  connectedAt: Date;
}

export interface SearchRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;      // 0–1
  position: number; // avg position (1 = top)
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
  token_expiry: Date | null;
  connected_email: string | null;
  connected_at: Date;
} | null> {
  try {
    const { db } = await import('@/db');
    const result = await db.execute(
      `SELECT site_url, access_token, refresh_token, token_expiry, connected_email, connected_at
       FROM gsc_connections ORDER BY id DESC LIMIT 1` as never
    ) as unknown as Array<{
      site_url: string; access_token: string | null; refresh_token: string;
      token_expiry: Date | null; connected_email: string | null; connected_at: Date;
    }>;
    return (result as unknown as typeof result)[0] ?? null;
  } catch {
    return null;
  }
}

/** Returns true if GSC tokens are stored in the DB */
export async function isGscConnected(): Promise<boolean> {
  const conn = await getRawConnection();
  return !!conn?.refresh_token;
}

/** Returns public connection info (no tokens) */
export async function getGscConnection(): Promise<GscConnection | null> {
  const conn = await getRawConnection();
  if (!conn) return null;
  return {
    siteUrl: conn.site_url,
    connectedEmail: conn.connected_email,
    connectedAt: conn.connected_at,
  };
}

/** Returns a valid access token, refreshing if necessary */
async function getAccessToken(): Promise<string | null> {
  const conn = await getRawConnection();
  if (!conn) return null;

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = new Date();
  const expiry = conn.token_expiry ? new Date(conn.token_expiry) : null;
  const needsRefresh = !conn.access_token || !expiry || expiry <= new Date(now.getTime() + 60_000);

  if (!needsRefresh && conn.access_token) return conn.access_token;

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
      console.error('[GSC] Token refresh failed:', res.status);
      return null;
    }
    const data = await res.json() as { access_token: string; expires_in: number };
    const newExpiry = new Date(Date.now() + data.expires_in * 1000);

    // Update DB
    const { db } = await import('@/db');
    await db.execute(
      `UPDATE gsc_connections SET access_token = '${data.access_token}', token_expiry = '${newExpiry.toISOString()}', updated_at = NOW() WHERE id = (SELECT id FROM gsc_connections ORDER BY id DESC LIMIT 1)` as never
    );

    return data.access_token;
  } catch (err) {
    console.error('[GSC] Token refresh error:', err instanceof Error ? err.message : 'unknown');
    return null;
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

  const token = await getAccessToken();
  if (!token) return { ok: false, reason: 'token_refresh_failed' };

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

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, reason: `API ${res.status}: ${txt.slice(0, 200)}` };
    }

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
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message.slice(0, 200) : 'fetch_error' };
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
