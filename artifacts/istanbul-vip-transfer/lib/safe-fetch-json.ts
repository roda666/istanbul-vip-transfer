/**
 * Safe fetch + JSON parser for admin API calls.
 *
 * Never call `response.json()` directly — responses can be HTML error pages,
 * proxy timeout pages, or empty bodies. This utility inspects Content-Type
 * first and returns structured errors with Turkish user-facing messages.
 */

export interface SafeJsonResult<T = unknown> {
  ok: boolean;
  data?: T;
  /** Turkish user-facing error message — safe to display. */
  error: string;
  httpStatus: number;
}

/**
 * Safely parse a fetch Response as JSON.
 * Logs sanitized debug info (status + short excerpt) to console.error.
 * Never exposes raw HTML, stack traces, API keys, or secrets to the caller.
 */
export async function safeJson<T = unknown>(
  res: Response,
  context = 'fetch',
): Promise<SafeJsonResult<T>> {
  const status = res.status;
  const ct = res.headers.get('content-type') ?? '';

  if (ct.includes('application/json')) {
    try {
      const data = (await res.json()) as T;
      if (!res.ok && status !== 207) {
        const errMsg = (data as Record<string, unknown>)?.error as string | undefined
          ?? statusToMessage(status);
        return { ok: false, data, error: errMsg, httpStatus: status };
      }
      return { ok: true, data, error: '', httpStatus: status };
    } catch (e) {
      console.error(`[${context}] JSON parse error HTTP ${status}:`, e);
      return { ok: false, error: 'Geçersiz JSON yanıtı alındı.', httpStatus: status };
    }
  }

  // HTML / plain-text (proxy error page, 502, 504, etc.)
  const raw = await res.text().catch(() => '');
  const excerpt = raw.slice(0, 200).replace(/[\n\r\t]+/g, ' ');
  console.error(`[${context}] HTTP ${status}, Content-Type: ${ct || 'none'}: ${excerpt}`);

  return {
    ok: false,
    error: statusToMessage(status),
    httpStatus: status,
  };
}

/**
 * Wraps fetch with error handling — catches network errors and AbortError.
 */
export async function safeFetch<T = unknown>(
  url: string,
  init?: RequestInit,
  context = 'fetch',
): Promise<SafeJsonResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const isAbort = e instanceof Error && e.name === 'AbortError';
    console.error(`[${context}] Network error:`, e);
    return {
      ok: false,
      error: isAbort
        ? 'İstek iptal edildi.'
        : 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.',
      httpStatus: 0,
    };
  }
  return safeJson<T>(res, context);
}

function statusToMessage(status: number): string {
  if (status === 0) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
  if (status === 400) return 'Geçersiz istek parametreleri (400).';
  if (status === 401 || status === 403)
    return 'Bu işlem için yetkiniz yok. Lütfen tekrar giriş yapın.';
  if (status === 404) return 'İstenen kaynak bulunamadı (404).';
  if (status === 408)
    return 'İstek zaman aşımına uğradı (408). Daha az dil seçerek tekrar deneyin.';
  if (status === 422)
    return 'İçerik yapısı geçersiz veya eksik (422). Lütfen kaynağı kontrol edin.';
  if (status === 429)
    return 'Çok fazla istek gönderildi. Lütfen kısa bir süre bekleyin ve tekrar deneyin (429).';
  if (status === 500) return 'Sunucu hatası oluştu (500). Tekrar deneyin.';
  if (status === 502 || status === 503 || status === 504)
    return 'Çeviri sunucusu geçerli bir yanıt vermedi. İşlem zaman aşımına uğramış olabilir.';
  return `Beklenmedik sunucu yanıtı (HTTP ${status}). Tekrar deneyin.`;
}
