import { describe, expect, it } from 'vitest';
import {
  findUnresolvedMessagePlaceholders,
  sanitizeChatbotReply,
} from '@/lib/chatbot-message-safety';

const FORM_URL = 'https://www.istanbulviptransfer.com/#rezervasyon';

describe('chatbot outbound message safety', () => {
  it('replaces the broken reservation-link placeholder with the approved URL', () => {
    expect(sanitizeChatbotReply(
      'Rezervasyon Formu: [buraya rezervasyon linki]',
      FORM_URL,
      'tr',
    )).toBe(`Rezervasyon Formu: ${FORM_URL}`);
  });

  it('replaces unsafe unresolved variables with a safe complete answer', () => {
    const result = sanitizeChatbotReply('Form: {{BOOKING_URL}}', FORM_URL, 'tr');
    expect(result).toBe(`Rezervasyon formuna buradan ulaşabilirsiniz: ${FORM_URL}`);
    expect(findUnresolvedMessagePlaceholders(result)).toEqual([]);
  });

  it('never emits a placeholder when a central URL is unavailable', () => {
    const result = sanitizeChatbotReply('Form: [booking link]', null, 'en');
    expect(result).not.toContain('[');
    expect(result).not.toContain('undefined');
  });
});