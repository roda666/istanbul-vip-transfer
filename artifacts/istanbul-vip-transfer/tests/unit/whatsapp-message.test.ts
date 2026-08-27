import { describe, expect, it } from 'vitest';
import {
  formatPhoneForWhatsAppMessage,
  formatWhatsAppLabel,
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

  it('adds plus only when the Turkish country code is already present', () => {
    expect(formatPhoneForWhatsAppMessage('905055877006')).toBe('+905055877006');
    expect(formatPhoneForWhatsAppMessage('0505 587 70 06')).toBe('0505 587 70 06');
  });
});