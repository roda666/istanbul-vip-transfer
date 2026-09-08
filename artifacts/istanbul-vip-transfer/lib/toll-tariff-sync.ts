import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

export const AVRASYA_TARIFF_URL = 'https://www.avrasyatuneli.com/ucretlendirme/';
const TOKEN_TTL_MS = 10 * 60 * 1000;

export type SyncedTariff = {
  amountKurus: number;
  sourceName: string;
  sourceUrl: string;
  fetchedAt: Date;
  /** The live page has no stated effective date; this is consequently required. */
  queriedAt: Date;
  validFrom: null;
};

type TariffIdentity = { sourceUrl: string | null; vehicleClass: string; timeBand: string };

function pageText(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function turkishLiraToKurus(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Resmî sayfadaki tutar biçimi doğrulanamadı.');
  return Math.round(Number(normalized) * 100);
}

/**
 * Strictly parses the three published Avrasya columns. This deliberately does
 * not attempt to infer a value from arbitrary nearby numbers: a layout/content
 * change becomes a safe manual-review failure instead of a wrong toll.
 */
export function parseAvrasyaTariffPage(html: string, timeBand: string, vehicleClass: string): number {
  const text = pageText(html);
  const row = timeBand === 'DAY'
    ? /Gündüz[\s\S]{0,100}?(\d{1,3}(?:\.\d{3})*,\d{2})\s*TL\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*TL\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*TL/i.exec(text)
    : timeBand === 'NIGHT'
      ? /Gece[\s\S]{0,100}?(\d{1,3}(?:\.\d{3})*,\d{2})\s*TL\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*TL\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*TL/i.exec(text)
      : null;
  if (!row) throw new Error('Avrasya resmî ücret tablosunda beklenen gündüz/gece satırı bulunamadı.');
  const column = vehicleClass === 'class_1' ? 1 : vehicleClass === 'class_2' ? 2 : vehicleClass === 'class_6' ? 3 : 0;
  if (!column) throw new Error('Bu araç sınıfı Avrasya adaptörünün yayımlanmış ücret tablosunda yok; manuel tarife kullanılmalıdır.');
  return turkishLiraToKurus(row[column]);
}

/**
 * Returns an adapter only for an exact, reviewed URL and supported row shape.
 * This is intentionally not a domain allowlist: no database-provided path,
 * query parameter, redirect, or admin-entered URL is ever fetched.
 */
export function isSupportedOfficialTariff(identity: TariffIdentity): boolean {
  return identity.sourceUrl === AVRASYA_TARIFF_URL
    && (identity.timeBand === 'DAY' || identity.timeBand === 'NIGHT')
    && ['class_1', 'class_2', 'class_6'].includes(identity.vehicleClass);
}

export async function fetchSupportedOfficialTariff(identity: TariffIdentity, fetcher: typeof fetch = fetch): Promise<SyncedTariff> {
  if (!isSupportedOfficialTariff(identity)) {
    throw new Error('Bu resmî kaynak/satır için güvenli bir otomatik adaptör yok. URL’ye istek atılmadı; manuel override kullanılabilir.');
  }
  const response = await fetcher(AVRASYA_TARIFF_URL, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    headers: { Accept: 'text/html,application/xhtml+xml' },
  });
  if (!response.ok) throw new Error(`Avrasya resmî tarife sayfası alınamadı (HTTP ${response.status}); manuel override kullanılabilir.`);
  const fetchedAt = new Date();
  const amountKurus = parseAvrasyaTariffPage(await response.text(), identity.timeBand, identity.vehicleClass);
  return { amountKurus, sourceName: 'Avrasya Tüneli İşletme A.Ş. — Ücretler', sourceUrl: AVRASYA_TARIFF_URL, fetchedAt, queriedAt: fetchedAt, validFrom: null };
}

type SignedPreview = SyncedTariff & { tariffId: string; expiresAt: number };

async function tokenSecret(): Promise<string | null> {
  const { resolveIntegrationSecret } = await import('@/lib/integration-secrets');
  // AUTH/NEXTAUTH are protected session roots and intentionally remain
  // environment-only fallback roots for legacy signed previews.
  return await resolveIntegrationSecret('TOLL_SYNC_TOKEN_SECRET') ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? null;
}
function signature(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** A short-lived signed preview prevents apply from accepting client-supplied money values. */
export async function signTariffSyncPreview(value: SyncedTariff & { tariffId: string }): Promise<string> {
  const secret = await tokenSecret();
  if (!secret) throw new Error('Tarife senkronizasyon onay anahtarı yapılandırılmamış.');
  const payload = Buffer.from(JSON.stringify({ ...value, fetchedAt: value.fetchedAt.toISOString(), queriedAt: value.queriedAt.toISOString(), expiresAt: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export async function verifyTariffSyncPreview(token: string, tariffId: string): Promise<SignedPreview> {
  const secret = await tokenSecret();
  const [payload, received] = token.split('.');
  if (!secret || !payload || !received) throw new Error('Senkronizasyon önizleme onayı geçersiz veya süresi dolmuş.');
  const expected = signature(payload, secret);
  if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) throw new Error('Senkronizasyon önizleme onayı geçersiz veya süresi dolmuş.');
  let decoded: SignedPreview;
  try { decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw new Error('Senkronizasyon önizleme onayı geçersiz veya süresi dolmuş.'); }
  if (decoded.tariffId !== tariffId || decoded.expiresAt < Date.now()
    || !Number.isInteger(decoded.amountKurus) || decoded.amountKurus < 1
    || decoded.sourceUrl !== AVRASYA_TARIFF_URL
    || Number.isNaN(new Date(decoded.fetchedAt).getTime()) || Number.isNaN(new Date(decoded.queriedAt).getTime())) {
    throw new Error('Senkronizasyon önizleme onayı geçersiz veya süresi dolmuş.');
  }
  return decoded;
}