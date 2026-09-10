import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from '../../lib/analytics';

describe('chatbot WhatsApp analytics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends only the safe chatbot source and interface language dimensions', () => {
    const gaTrack = vi.fn();
    const replitTrack = vi.fn();
    vi.stubGlobal('window', {
      gtag: gaTrack,
      umami: { track: replitTrack },
    });

    const dimensions = { source: 'chatbot', language: 'en' };
    trackEvent('chatbot_whatsapp_click', dimensions);

    expect(replitTrack).toHaveBeenCalledWith('chatbot_whatsapp_click', dimensions);
    expect(gaTrack).toHaveBeenCalledWith('event', 'chatbot_whatsapp_click', dimensions);
    expect(dimensions).toEqual({ source: 'chatbot', language: 'en' });
  });

  it('never breaks the booking handoff when a tracker throws or is absent', () => {
    const gaTrack = vi.fn();
    vi.stubGlobal('window', {
      gtag: gaTrack,
      umami: { track: vi.fn(() => { throw new Error('tracker unavailable'); }) },
    });

    expect(() => trackEvent('chatbot_whatsapp_click', {
      source: 'chatbot',
      language: 'tr',
    })).not.toThrow();
    expect(gaTrack).toHaveBeenCalledOnce();

    vi.stubGlobal('window', {});
    expect(() => trackEvent('chatbot_whatsapp_click')).not.toThrow();
  });
});