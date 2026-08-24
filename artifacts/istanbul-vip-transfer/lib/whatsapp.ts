/**
 * Opens a WhatsApp conversation without making the visitor wait for a
 * database request. Android's package-qualified intent prefers WhatsApp
 * Business when it is installed; the regular wa.me URL remains the fallback.
 */
export function openWhatsAppChat(phone: string, message: string): void {
  const digits = phone.replace(/\D/g, '');
  const webUrl = `https://wa.me/${digits}?text=${message}`;

  if (typeof window === 'undefined') return;

  if (/Android/i.test(navigator.userAgent)) {
    const businessIntent =
      `intent://send?phone=${digits}&text=${message}` +
      '#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end';
    const fallbackTimer = window.setTimeout(() => {
      document.removeEventListener('visibilitychange', clearFallback);
      if (!document.hidden) window.location.assign(webUrl);
    }, 1400);
    const clearFallback = () => {
      window.clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', clearFallback);
    };

    document.addEventListener('visibilitychange', clearFallback, { once: true });
    window.location.assign(businessIntent);
    return;
  }

  const popup = window.open(webUrl, '_blank', 'noopener,noreferrer');
  if (!popup) window.location.assign(webUrl);
}