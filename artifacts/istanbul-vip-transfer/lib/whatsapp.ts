/**
 * Opens a WhatsApp conversation in a separate browsing context without making
 * the visitor wait for a database request. A real target=_blank link avoids
 * iframe navigation in Replit preview and preserves the booking page.
 */
export function formatWhatsAppLabel(label: string): string {
  return `*${label.trim().replace(/^\*+|\*+$/g, '')}*`;
}

export function formatPhoneForWhatsAppMessage(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  if (trimmed.startsWith('00')) return `+${digits.slice(2)}`;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (/^90\d{10}$/.test(digits)) return `+${digits}`;
  if (/^0\d{10}$/.test(digits)) return `+90${digits.slice(1)}`;
  if (/^\d{10}$/.test(digits)) return `+90${digits}`;
  return `+${digits}`;
}

export function normalizeWhatsAppRecipient(phone: string): string {
  return formatPhoneForWhatsAppMessage(phone).replace(/\D/g, '');
}

export function buildWhatsAppChatUrl(phone: string, message?: string): string {
  const baseUrl = `https://wa.me/${normalizeWhatsAppRecipient(phone)}`;
  return message === undefined ? baseUrl : `${baseUrl}?text=${encodeURIComponent(message)}`;
}

export function openWhatsAppChat(phone: string, message: string): void {
  const webUrl = buildWhatsAppChatUrl(phone, message);

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