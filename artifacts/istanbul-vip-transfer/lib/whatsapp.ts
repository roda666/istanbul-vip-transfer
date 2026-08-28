/**
 * Opens a WhatsApp conversation in a separate browsing context without making
 * the visitor wait for a database request. A real target=_blank link avoids
 * iframe navigation in Replit preview and preserves the booking page.
 */
export function formatWhatsAppLabel(label: string): string {
  return `*${label.trim().replace(/^\*+|\*+$/g, '')}*`;
}

/**
 * Keeps an explicitly entered international "+" and restores it when a
 * Turkish country code (90 + 10 digits) was entered without the plus.
 * Local numbers are left as typed because guessing a country code is unsafe.
 */
export function formatPhoneForWhatsAppMessage(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (/^90\d{10}$/.test(digits)) return `+${digits}`;
  return trimmed;
}

export function openWhatsAppChat(phone: string, message: string): void {
  const digits = phone.replace(/\D/g, '');
  // The message contains visitor-provided fields and can include spaces, line
  // breaks, ampersands, or non-Latin text. Encode it once for both the web
  // deep link and Android's WhatsApp Business intent so no field is truncated
  // or interpreted as another query parameter.
  const encodedMessage = encodeURIComponent(message);
  const webUrl = `https://wa.me/${digits}?text=${encodedMessage}`;

  if (typeof window === 'undefined') return;

  const link = document.createElement('a');
  link.href = webUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}