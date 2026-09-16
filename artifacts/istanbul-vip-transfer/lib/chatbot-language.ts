import { getLocaleEntry, isRegistryLocale } from '@/lib/i18n/locale-registry';

export type ChatbotLanguage =
  | 'tr' | 'en' | 'de' | 'ru' | 'ar' | 'fr' | 'es' | 'it' | 'nl';

export type LanguageDetection = {
  language: ChatbotLanguage | null;
  confidence: number;
  meaningful: boolean;
  strong: boolean;
};

const WORDS: Record<ChatbotLanguage, readonly string[]> = {
  tr: [
    'merhaba', 'nasıl', 'nasil', 'rezervasyon', 'fiyat', 'istiyorum', 'için', 'icin',
    'araç', 'arac', 'hazır', 'hazir', 'olacak', 'teşekkür', 'tesekkur', 'lütfen',
    'lutfen', 'nereden', 'nereye', 'saat', 'bizi', 'sizi', 'müşteri', 'musteri',
  ],
  en: [
    'hello', 'booking', 'reserve', 'price', 'airport', 'please', 'want', 'need',
    'your', 'vehicle', 'ready', 'will', 'thank', 'from', 'where', 'when', 'customer',
    'would', 'could', 'pickup', 'dropoff', 'passenger', 'today', 'tomorrow',
    'access', 'form', 'quote', 'section', 'homepage',
  ],
  de: [
    'hallo', 'buchung', 'reservieren', 'preis', 'flughafen', 'bitte', 'möchte',
    'mochte', 'brauche', 'ihr', 'fahrzeug', 'bereit', 'wird', 'danke', 'von',
    'nach', 'wann', 'kunde', 'abholung', 'fahrgast', 'heute', 'morgen',
    'buchungsformular', 'finden', 'bereich', 'startseite',
  ],
  ru: [
    'здравствуйте', 'привет', 'бронирование', 'забронировать', 'трансфер', 'цена',
    'аэропорт', 'пожалуйста', 'нужен', 'ваш', 'автомобиль', 'готов', 'будет',
    'спасибо', 'откуда', 'куда', 'когда', 'клиент', 'пассажир', 'сегодня', 'завтра',
  ],
  ar: [
    'مرحبا', 'حجز', 'احجز', 'نقل', 'سعر', 'مطار', 'فضلك', 'أريد', 'اريد',
    'سيارتك', 'السيارة', 'جاهزة', 'ستكون', 'شكرا', 'شكرًا', 'من', 'إلى', 'الى',
    'متى', 'العميل', 'راكب', 'اليوم', 'غدا', 'غدًا',
  ],
  fr: [
    'bonjour', 'réserver', 'reservation', 'réservation', 'transfert', 'prix',
    'aéroport', 'merci', 'voudrais', 'votre', 'véhicule', 'prêt', 'prête', 'sera',
    'depuis', 'vers', 'quand', 'client', 'passager', 'aujourd’hui', 'demain',
    'veux', 'voiture', 'pouvez', 'formulaire', 'devis', 'section', 'accéder',
  ],
  es: [
    'hola', 'reservar', 'reserva', 'traslado', 'precio', 'aeropuerto', 'quiero',
    'necesito', 'gracias', 'vehículo', 'vehiculo', 'listo', 'estará', 'estara',
    'desde', 'hasta', 'cuándo', 'cuando', 'cliente', 'pasajero', 'hoy', 'mañana',
    'puede', 'coche', 'formulario', 'presupuesto', 'sección', 'página', 'inicio',
  ],
  it: [
    'ciao', 'prenotare', 'prenotazione', 'trasferimento', 'prezzo', 'aeroporto',
    'vorrei', 'bisogno', 'grazie', 'veicolo', 'pronto', 'sarà', 'sara', 'da',
    'verso', 'quando', 'cliente', 'passeggero', 'oggi', 'domani', 'potete', 'auto',
    'modulo', 'sezione', 'preventivo', 'pagina',
  ],
  nl: [
    'hallo', 'boeken', 'boeking', 'prijs', 'luchthaven', 'alstublieft', 'nodig',
    'bedankt', 'voertuig', 'klaar', 'zal', 'vanaf', 'naar', 'wanneer', 'klant',
    'passagier', 'vandaag', 'morgen', 'graag', 'auto', 'kunt', 'ophalen',
    'boekingsformulier', 'gedeelte', 'offerte', 'homepage',
  ],
};

const SCRIPT_RE: Partial<Record<ChatbotLanguage, RegExp>> = {
  ar: /[\u0600-\u06ff]/u,
  ru: /[\u0400-\u04ff]/u,
};

const SUPPORTED = Object.keys(WORDS) as ChatbotLanguage[];

export function normalizeChatbotLanguage(value: unknown, fallback: ChatbotLanguage = 'tr'): ChatbotLanguage {
  const code = typeof value === 'string' ? value.toLowerCase().split('-')[0] : '';
  return isRegistryLocale(code) && SUPPORTED.includes(code as ChatbotLanguage)
    ? code as ChatbotLanguage
    : fallback;
}

export function getChatbotLanguageName(lang: ChatbotLanguage): string {
  return getLocaleEntry(lang)?.englishName ?? 'Turkish';
}

export function getChatbotDirection(lang: ChatbotLanguage): 'ltr' | 'rtl' {
  return getLocaleEntry(lang)?.dir ?? 'ltr';
}

function tokenise(text: string): string[] {
  return text.toLocaleLowerCase().match(/[\p{L}\p{M}’']+/gu) ?? [];
}

/**
 * Deliberately conservative detector. It never returns a guess for a short or
 * evenly-scored message; callers retain the page/session language then.
 */
export function detectChatbotLanguage(text: string): LanguageDetection {
  const cleaned = text.trim();
  const tokens = tokenise(cleaned);
  if (tokens.length < 2 || cleaned.length < 8) {
    return { language: null, confidence: 0, meaningful: false, strong: false };
  }

  const scores = new Map<ChatbotLanguage, number>(SUPPORTED.map(lang => [lang, 0]));
  for (const lang of SUPPORTED) {
    const script = SCRIPT_RE[lang];
    if (script?.test(cleaned)) scores.set(lang, (scores.get(lang) ?? 0) + 4);
    const hits = tokens.filter(token => WORDS[lang].some(word => token === word || token.startsWith(`${word}’`)));
    scores.set(lang, (scores.get(lang) ?? 0) + hits.length * 2);
  }
  // Distinguish the Romance languages with common function words and accents.
  if (/[àâçéèêëîïôùûüÿœ]/u.test(cleaned)) {
    scores.set('fr', (scores.get('fr') ?? 0) + 2);
  }
  if (/[ñ¿¡]/u.test(cleaned)) scores.set('es', (scores.get('es') ?? 0) + 2);
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best[1] < 2 || best[1] === second?.[1]) {
    return { language: null, confidence: 0, meaningful: true, strong: false };
  }
  const confidence = Math.min(1, best[1] / Math.max(4, tokens.length * 2));
  return {
    language: best[0],
    confidence,
    meaningful: true,
    strong: best[1] >= 4 && best[1] - (second?.[1] ?? 0) >= 2,
  };
}

export function chooseChatbotLanguage(
  current: ChatbotLanguage,
  hint: unknown,
  text: string,
  hasPreviousMeaningfulMessage: boolean,
): ChatbotLanguage {
  const detection = detectChatbotLanguage(text);
  if (!detection.language) return current;
  const hinted = normalizeChatbotLanguage(hint, current);
  if (!hasPreviousMeaningfulMessage) return detection.strong ? detection.language : hinted;
  return detection.strong && detection.language !== current ? detection.language : current;
}

export function isLikelyLanguage(text: string, expected: ChatbotLanguage): boolean {
  const detection = detectChatbotLanguage(text);
  return detection.language === expected && detection.strong;
}
