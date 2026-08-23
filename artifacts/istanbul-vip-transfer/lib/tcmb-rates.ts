/** TCMB daily XML parser. Values are stored as integer micro-units, never floats. */
export type TcmbRateCandidate = {
  source: 'TCMB';
  eurTryMicros: number;
  usdTryMicros: number;
  eurUsdMicros: number;
  fetchedAt: string;
};

function toMicros(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const micros = Number(whole) * 1_000_000 + Number((fraction + '000000').slice(0, 6));
  return Number.isSafeInteger(micros) && micros > 0 ? micros : null;
}

function sellingRate(xml: string, code: 'EUR' | 'USD'): number | null {
  const currency = new RegExp(`<Currency\\b[^>]*CurrencyCode="${code}"[^>]*>([\\s\\S]*?)<\\/Currency>`, 'i').exec(xml)?.[1];
  const value = currency && /<ForexSelling>([^<]+)<\/ForexSelling>/i.exec(currency)?.[1];
  return value ? toMicros(value) : null;
}

export function parseTcmbDailyXml(xml: string): TcmbRateCandidate | null {
  const eurTryMicros = sellingRate(xml, 'EUR');
  const usdTryMicros = sellingRate(xml, 'USD');
  if (!eurTryMicros || !usdTryMicros) return null;
  return {
    source: 'TCMB',
    eurTryMicros,
    usdTryMicros,
    eurUsdMicros: Math.round((eurTryMicros * 1_000_000) / usdTryMicros),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchTcmbRates(): Promise<TcmbRateCandidate> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/xml,text/xml;q=0.9' },
    });
    if (!response.ok) throw new Error(`TCMB ${response.status}`);
    const candidate = parseTcmbDailyXml(await response.text());
    if (!candidate) throw new Error('TCMB EUR/USD satış kurları okunamadı.');
    return candidate;
  } finally {
    clearTimeout(timer);
  }
}