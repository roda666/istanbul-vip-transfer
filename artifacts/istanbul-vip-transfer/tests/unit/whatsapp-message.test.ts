import { describe, expect, it } from 'vitest';
import {
  buildWhatsAppChatUrl,
  formatPhoneForWhatsAppMessage,
  formatWhatsAppLabel,
  normalizeWhatsAppRecipient,
} from '@/lib/whatsapp';

describe('WhatsApp customer message formatting', () => {
  it('wraps a fixed label in WhatsApp bold markers once', () => {
    expect(formatWhatsAppLabel('Hizmet')).toBe('*Hizmet*');
    expect(formatWhatsAppLabel('*Telefon*')).toBe('*Telefon*');
  });

  it('preserves an explicit plus and normalizes its digits', () => {
    expect(formatPhoneForWhatsAppMessage('+90 (505) 587 70 06'))
      .toBe('+905055877006');
  });

  it('always formats Turkish local and international numbers with a plus', () => {
    expect(formatPhoneForWhatsAppMessage('905055877006')).toBe('+905055877006');
    expect(formatPhoneForWhatsAppMessage('0505 587 70 06')).toBe('+905055877006');
    expect(formatPhoneForWhatsAppMessage('505 587 70 06')).toBe('+905055877006');
  });

  it('builds a digits-only wa.me recipient and encodes a plain message exactly once', () => {
    const message = 'Merhaba Nuri Özkan, IVT referansı: IVT-123 hakkında ulaşmak istedik.';
    const url = buildWhatsAppChatUrl('+90 (505) 587 70 06', message);
    expect(new URL(url).pathname).toBe('/905055877006');
    expect(new URL(url).searchParams.get('text')).toBe(message);
    expect(url).not.toContain('%2520');
    expect(normalizeWhatsAppRecipient('0505 587 70 06')).toBe('905055877006');
  });
});