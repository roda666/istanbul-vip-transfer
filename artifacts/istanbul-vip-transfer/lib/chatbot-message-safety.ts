const LINK_PLACEHOLDER_PATTERN =
  /\[\s*[^\]\n]*(?:buraya|bağlantı|link|adres|url|reservation|booking|contact|whatsapp|form)[^\]\n]*\s*\]/giu;

const UNRESOLVED_PATTERNS = [
  LINK_PLACEHOLDER_PATTERN,
  /\[\s*(?:[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9_ -]{1,}|\.{2,})\s*\]/gu,
  /\{\{\s*[^{}]*\s*\}\}/g,
  /\$\{\s*[^{}]*\s*\}/g,
  /<%\s*[^%]*\s*%>/g,
] as const;

const FALLBACKS: Record<string, (url: string | null) => string> = {
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
};

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
    return (FALLBACKS[visitorLang] ?? FALLBACKS.en)(reservationFormUrl);
  }
  return repaired;
}