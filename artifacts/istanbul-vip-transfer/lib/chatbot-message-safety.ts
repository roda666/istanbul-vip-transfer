const LINK_PLACEHOLDER_PATTERN =
  /\[\s*[^\]\n]*(?:buraya|bağlantı|link|adres|url|reservation|booking|contact|whatsapp|form)[^\]\n]*\s*\]/giu;

const UNRESOLVED_PATTERNS = [
  LINK_PLACEHOLDER_PATTERN,
  /\[\s*(?:[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9_ -]{1,}|\.{2,})\s*\]/gu,
  /\{\{\s*[^{}]*\s*\}\}/g,
  /\$\{\s*[^{}]*\s*\}/g,
  /<%\s*[^%]*\s*%>/g,
] as const;

export const FALLBACKS: Record<string, (url: string | null) => string> = {
  tr: (url) => url
    ? `Rezervasyon formuna buradan ulaşabilirsiniz: ${url}`
    : 'Rezervasyon formuna ana sayfadaki “Fiyat Al / Rezervasyon” bölümünden ulaşabilirsiniz.',
  en: (url) => url
    ? `You can access the booking form here: ${url}`
    : 'You can access the booking form from the “Get a Quote / Booking” section on the homepage.',
  de: (url) => url
    ? `Hier finden Sie das Buchungsformular: ${url}`
    : 'Das Buchungsformular finden Sie im Bereich „Preis anfragen / Buchen“ auf der Startseite.',
  ru: (url) => url
    ? `Форма бронирования доступна здесь: ${url}`
    : 'Форма бронирования находится в разделе «Узнать цену / Бронирование» на главной странице.',
  ar: (url) => url
    ? `يمكنك الوصول إلى نموذج الحجز هنا: ${url}`
    : 'يمكنك الوصول إلى نموذج الحجز من قسم طلب السعر / الحجز في الصفحة الرئيسية.',
  fr: (url) => url
    ? `Vous pouvez accéder au formulaire de réservation ici : ${url}`
    : 'Vous pouvez accéder au formulaire de réservation depuis la section « Demander un devis / Réservation » de la page d’accueil.',
  es: (url) => url
    ? `Puede acceder al formulario de reserva aquí: ${url}`
    : 'Puede acceder al formulario de reserva desde la sección « Solicitar presupuesto / Reserva » de la página de inicio.',
  it: (url) => url
    ? `Puoi accedere al modulo di prenotazione qui: ${url}`
    : 'Puoi accedere al modulo di prenotazione dalla sezione « Richiedi un preventivo / Prenotazione » della home page.',
  nl: (url) => url
    ? `U vindt het boekingsformulier hier: ${url}`
    : 'U vindt het boekingsformulier in het gedeelte “Offerte aanvragen / Boeken” op de homepage.',
};

export function getChatbotFallback(visitorLang: string, reservationFormUrl: string | null): string {
  return (FALLBACKS[visitorLang] ?? FALLBACKS.en)(reservationFormUrl);
}

export function findUnresolvedMessagePlaceholders(text: string): string[] {
  const matches = new Set<string>();
  for (const pattern of UNRESOLVED_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) matches.add(match[0]);
  }
  return [...matches];
}

export function sanitizeChatbotReply(
  reply: string,
  reservationFormUrl: string | null,
  visitorLang: string,
): string {
  LINK_PLACEHOLDER_PATTERN.lastIndex = 0;
  const hadLinkPlaceholder = LINK_PLACEHOLDER_PATTERN.test(reply);
  LINK_PLACEHOLDER_PATTERN.lastIndex = 0;
  const repaired = reply.replace(
    LINK_PLACEHOLDER_PATTERN,
    reservationFormUrl ?? '',
  ).trim();

  if (
    !repaired
    || findUnresolvedMessagePlaceholders(repaired).length > 0
    || (hadLinkPlaceholder && !reservationFormUrl)
  ) {
    return getChatbotFallback(visitorLang, reservationFormUrl);
  }
  return repaired;
}