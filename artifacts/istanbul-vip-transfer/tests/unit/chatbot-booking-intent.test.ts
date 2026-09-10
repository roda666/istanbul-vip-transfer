import { describe, expect, it } from 'vitest';
import { detectBookingIntent, formatBookingWhatsAppMessage } from '../../lib/chatbot-booking-intent';

describe('chatbot booking intent', () => {
  it('extracts only route, date and passenger details stated by the visitor', () => {
    const result = detectBookingIntent([
      { role: 'user', content: 'I want to reserve from IST to Sultanahmet for 2026-08-12, 3 passengers.' },
    ]);
    expect(result.ready).toBe(true);
    expect(result.details).toEqual({ route: 'IST - Sultanahmet', date: '2026-08-12', passengers: 3 });
  });

  it('does not invent missing booking details', () => {
    const result = detectBookingIntent([{ role: 'user', content: 'Can I book a VIP transfer?' }]);
    expect(result.ready).toBe(true);
    expect(result.details).toEqual({});
    const message = formatBookingWhatsAppMessage(result.details);
    expect(message).not.toContain('Güzergâh:');
    expect(message).not.toContain('Tarih:');
    expect(message).not.toContain('Yolcu sayısı:');
  });

  it('localizes the WhatsApp intro and labels without adding absent values', () => {
    expect(formatBookingWhatsAppMessage({ route: 'IST - Kadıköy' }, 'en'))
      .toBe('Hello, I would like to make a booking.\nRoute: IST - Kadıköy');
    expect(formatBookingWhatsAppMessage({}, 'de')).toBe('Hallo, ich möchte eine Buchung vornehmen.');
  });
});