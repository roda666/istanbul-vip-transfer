export type BookingIntentDetails = {
  route?: string;
  date?: string;
  passengers?: number;
};

export type BookingIntent = { ready: boolean; details: BookingIntentDetails };

/** Deliberately conservative: only values explicitly present in visitor text. */
export function detectBookingIntent(history: Array<{ role: string; content: string }>): BookingIntent {
  const text = history.filter(m => m.role === 'user').map(m => m.content).join(' ');
  const ready = /\b(book|booking|reserve|reservation|whatsapp|rezerv|ayır|ayir|havalimanına transfer)\b/i.test(text);
  const passengers = text.match(/\b(\d{1,2})\s*(?:passengers?|people|persons?|pax|kişi|kisilik)\b/i);
  const date = text.match(/\b(?:on|for|tarih(?:i)?|date)\s*:?\s*([0-3]?\d[./-][01]?\d(?:[./-]\d{2,4})?)\b/i)
    ?? text.match(/\b(20\d{2}[./-][01]?\d[./-][0-3]?\d)\b/);
  const route = text.match(/\b(?:from|arasında|arasinda)\s+(.{2,60}?)\s+(?:to|ile|arası|arasi)\s+(.{2,60}?)(?=\s+(?:for|on|tarih|date)\b|\s+20\d{2}\b|[,.!?]|$)/i);
  return {
    ready,
    details: {
      ...(route ? { route: `${route[1].trim()} - ${route[2].trim()}` } : {}),
      ...(date ? { date: date[1] } : {}),
      ...(passengers ? { passengers: Number(passengers[1]) } : {}),
    },
  };
}

export function formatBookingWhatsAppMessage(details: BookingIntentDetails, lang = 'tr'): string {
  const copy: Record<string, [string, string, string, string]> = {
    tr: ['Merhaba, rezervasyon yapmak istiyorum.', 'Güzergâh', 'Tarih', 'Yolcu sayısı'],
    en: ['Hello, I would like to make a booking.', 'Route', 'Date', 'Passengers'],
    de: ['Hallo, ich möchte eine Buchung vornehmen.', 'Route', 'Datum', 'Passagiere'],
    ru: ['Здравствуйте, я хочу забронировать трансфер.', 'Маршрут', 'Дата', 'Пассажиры'],
    ar: ['مرحبًا، أود إجراء حجز.', 'المسار', 'التاريخ', 'عدد الركاب'],
    es: ['Hola, me gustaría hacer una reserva.', 'Ruta', 'Fecha', 'Pasajeros'],
    fr: ['Bonjour, je souhaite effectuer une réservation.', 'Itinéraire', 'Date', 'Passagers'],
    it: ['Salve, vorrei effettuare una prenotazione.', 'Percorso', 'Data', 'Passeggeri'],
    nl: ['Hallo, ik wil graag een boeking maken.', 'Route', 'Datum', 'Passagiers'],
  };
  const [intro, routeLabel, dateLabel, passengerLabel] = copy[lang] ?? copy.en;
  const lines = [intro];
  if (details.route) lines.push(`${routeLabel}: ${details.route}`);
  if (details.date) lines.push(`${dateLabel}: ${details.date}`);
  if (details.passengers) lines.push(`${passengerLabel}: ${details.passengers}`);
  return lines.join('\n');
}