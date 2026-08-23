const SOCIAL_OAUTH_MESSAGES: Record<string, string> = {
  x_credentials_missing:
    'X bağlantısı için gerekli anahtarlar veya şifreleme ayarı eksik. Replit Secrets ayarlarını kontrol edin.',
  x_unauthorized:
    'X bağlantısını başlatmak için yönetici oturumunuzla yeniden giriş yapın.',
  x_credits_depleted:
    'X API kredisi gerekiyor. X Developer Portal üzerinden kredi/plan durumunu güncelleyip tekrar deneyin.',
  x_request_token_failed:
    'X yetkilendirme isteği başlatılamadı. X uygulama ayarlarını ve API erişim planını kontrol edip tekrar deneyin.',
  x_invalid_state:
    'X güvenlik doğrulaması geçersiz veya süresi dolmuş. Bağlantıyı yeniden başlatın.',
  x_access_token_failed:
    'X yetkilendirmesi tamamlanamadı. İzni tekrar verip yeniden deneyin.',
  google_business_credentials_missing:
    'Google Business Profile bağlantısı için Google OAuth istemci ayarları eksik.',
  google_business_consent_denied:
    'Google Business Profile erişim izni verilmedi. İşletme yöneticisi hesabıyla tekrar deneyin.',
  google_business_invalid_state:
    'Google Business Profile güvenlik doğrulaması geçersiz veya süresi dolmuş. Bağlantıyı yeniden başlatın.',
  google_business_token_exchange_failed:
    'Google Business Profile yetkilendirmesi tamamlanamadı. İzni tekrar verip yeniden deneyin.',
  google_business_connection_failed:
    'Google Business Profile bağlantısı tamamlanamadı. OAuth ayarlarını ve işletme yetkilerini kontrol edin.',
};

export function getSocialOAuthMessage(code: string | null | undefined): string {
  return (code && SOCIAL_OAUTH_MESSAGES[code])
    ?? 'Sosyal medya bağlantısı tamamlanamadı. Lütfen tekrar deneyin.';
}

export function getSocialPlatformLastErrorMessage(platformKey: string, error: string): string {
  if (platformKey === 'x') {
    return classifyXOAuthFailure(error) === 'x_credits_depleted'
      ? getSocialOAuthMessage('x_credits_depleted')
      : 'X ile yapılan son işlem tamamlanamadı. Bağlantıyı ve X API ayarlarını kontrol edip tekrar deneyin.';
  }
  return 'Sosyal medya platformuyla yapılan son işlem tamamlanamadı. Bağlantıyı kontrol edip tekrar deneyin.';
}

/**
 * Converts provider errors to a finite, safe set of client-facing states.
 * Provider responses are never shown directly because they can be noisy and
 * occasionally include implementation details.
 */
export function classifyXOAuthFailure(error: unknown): 'x_credits_depleted' | 'x_request_token_failed' {
  const details = getProviderErrorDetails(error).toLowerCase();
  if (/(?:^|\D)402(?:\D|$)|credits?\s+depleted|payment\s+required|quota\s+(?:exceeded|depleted)|billing/i.test(details)) {
    return 'x_credits_depleted';
  }
  return 'x_request_token_failed';
}

function getProviderErrorDetails(error: unknown): string {
  const parts: string[] = [];
  const visited = new Set<unknown>();
  const collect = (value: unknown, depth = 0): void => {
    if (depth > 3 || value === null || value === undefined || visited.has(value)) return;
    if (typeof value === 'string' || typeof value === 'number') {
      parts.push(String(value));
      return;
    }
    if (value instanceof Error) {
      visited.add(value);
      parts.push(value.message);
      collect(value.cause, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      visited.add(value);
      const record = value as Record<string, unknown>;
      for (const key of ['message', 'detail', 'title', 'code', 'status', 'statusCode', 'error', 'data', 'response', 'body']) {
        collect(record[key], depth + 1);
      }
    }
  };
  collect(error);
  return parts.join(' ');
}