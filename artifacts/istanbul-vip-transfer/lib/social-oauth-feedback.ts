const SOCIAL_OAUTH_MESSAGES: Record<string, string> = {
  x_credentials_missing:
    'X bağlantısı için gerekli anahtarlar veya şifreleme ayarı eksik. Replit Secrets ayarlarını kontrol edin.',
  x_unauthorized:
    'X bağlantısını başlatmak için yönetici oturumunuzla yeniden giriş yapın.',
  x_credits_depleted:
    'X API erişimi plan veya kredi limiti nedeniyle reddedildi. X Developer Portal üzerinden kredi/plan durumunu güncelleyip tekrar deneyin.',
  x_request_token_failed:
    'X yetkilendirme isteği başlatılamadı. X uygulama ayarlarını ve API erişim planını kontrol edip tekrar deneyin.',
  x_invalid_state:
    'X güvenlik doğrulaması geçersiz veya süresi dolmuş. Bağlantıyı yeniden başlatın.',
  x_access_token_failed:
    'X yetkilendirmesi tamamlanamadı. İzni tekrar verip yeniden deneyin.',
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
  if (/(credits?\s+depleted|payment\s+required|quota\s+(?:exceeded|depleted)|billing)/i.test(details)) {
    return 'x_credits_depleted';
  }
  return 'x_request_token_failed';
}

function getProviderErrorDetails(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    return [value.message, value.detail, value.title, value.code]
      .filter((item): item is string => typeof item === 'string')
      .join(' ');
  }
  return '';
}