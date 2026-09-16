import { describe, expect, it } from 'vitest';
import { chooseChatbotLanguage, detectChatbotLanguage, getChatbotDirection } from '../../lib/chatbot-language';

describe('chatbot language policy', () => {
  const samples: Record<string, string> = {
    tr: 'Merhaba, İstanbul havalimanı transferi istiyorum',
    en: 'Hello, I need an airport transfer please',
    de: 'Hallo, ich brauche bitte einen Flughafentransfer',
    ru: 'Здравствуйте, мне нужен трансфер из аэропорта',
    ar: 'مرحبا أريد حجز نقل من المطار',
    fr: 'Bonjour, je voudrais réserver un transfert aéroport',
    es: 'Hola, quiero reservar un traslado del aeropuerto',
    it: 'Ciao, vorrei prenotare un trasferimento dall’aeroporto',
    nl: 'Hallo, ik wil een transfer vanaf de luchthaven boeken',
  };

  it.each(Object.entries(samples))('detects %s', (lang, text) => {
    expect(detectChatbotLanguage(text).language).toBe(lang);
  });

  it('keeps the hint for short or ambiguous text and only switches on strong evidence', () => {
    expect(chooseChatbotLanguage('de', 'de', 'OK', false)).toBe('de');
    expect(chooseChatbotLanguage('de', 'de', 'Hello, I need an airport transfer please', true)).toBe('en');
    expect(getChatbotDirection('ar')).toBe('rtl');
  });
});
