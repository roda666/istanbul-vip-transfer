import { describe, expect, it } from 'vitest';
import { validateCustomerTranslation } from '../../lib/chatbot-translate';
import { getChatbotFallback } from '../../lib/chatbot-message-safety';

const translatedReplies = {
  tr: 'Aracınız yarın saat 10.00’da hazır olacak.',
  en: 'Your vehicle will be ready tomorrow at 10:00.',
  de: 'Ihr Fahrzeug wird morgen um 10:00 Uhr bereit sein.',
  ru: 'Ваш автомобиль будет готов завтра в 10:00.',
  ar: 'ستكون سيارتك جاهزة غدًا الساعة 10:00.',
  fr: 'Votre véhicule sera prêt demain à 10 h.',
  es: 'Su vehículo estará listo mañana a las 10:00.',
  it: 'Il suo veicolo sarà pronto domani alle 10:00.',
  nl: 'Uw voertuig zal morgen om 10:00 klaar zijn.',
} as const;

describe('chatbot customer-facing translation safety', () => {
  const source = translatedReplies.tr;

  it.each(Object.entries(translatedReplies))(
    'accepts a verified %s customer message',
    (language, translated) => {
      expect(validateCustomerTranslation(source, translated, language).valid).toBe(true);
    },
  );

  it.each(['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'])(
    'blocks empty, unchanged Turkish, and wrong-language output for %s',
    (language) => {
      expect(validateCustomerTranslation(source, '', language).valid).toBe(false);
      expect(validateCustomerTranslation(source, source, language).valid).toBe(false);
      expect(validateCustomerTranslation(source, translatedReplies.en, language).valid)
        .toBe(language === 'en');
    },
  );

  it('keeps every foreign safe fallback in its own detected language', () => {
    for (const language of ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'] as const) {
      const fallback = getChatbotFallback(language, null);
      expect(
        validateCustomerTranslation(source, fallback, language).valid,
        `${language} güvenli fallback metni kendi dilinde doğrulanmalı`,
      ).toBe(true);
    }
  });
});