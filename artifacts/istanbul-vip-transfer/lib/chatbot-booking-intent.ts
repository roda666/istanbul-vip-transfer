export type BookingIntentDetails = {
  route?: string;
  date?: string;
  passengers?: number;
};

export type BookingIntent = { ready: boolean; details: BookingIntentDetails };

/** Deliberately conservative: only values explicitly present in visitor text. */
export function detectBookingIntent(history: Array<{ role: string; content: string }>): BookingIntent {
  const text = history.filter(m => m.role === 'user').map(m => m.content).join(' ');
  const ready = /(book|booking|reserve|reservation|whatsapp|rezerv|ayır|ayir|havalimanına transfer|buchung|buchen|reservieren|flughafentransfer|забронировать|бронирование|حجز|احجز|نقل المطار|réserver|réservation|traslado al aeropuerto|reservar|reserva|prenotare|prenotazione|luchthavenvervoer|boeken|boeking)/iu.test(text);
  const passengers = text.match(/\b(\d{1,2})\s*(?:passengers?|people|persons?|pax|kişi|kisilik|personen?|passagiere|passagers?|pasajeros?|passeggeri|passagiers)\b/i);
  const numericDate = text.match(/\b(?:on|for|tarih(?:i)?|date|am|für|für den|на|дата|في|le|el|il|op)\s*:?\s*([0-3]?\d[./-][01]?\d(?:[./-]\d{2,4})?)\b/i)
    ?? text.match(/\b(20\d{2}[./-][01]?\d[./-][0-3]?\d)\b/);
  const relativeDate = text.match(
    /(?:^|\s)(today|tomorrow|bugün|bugun|yarın|yarin|heute|morgen|сегодня|завтра|اليوم|غدًا|غدا|aujourd’hui|aujourd'hui|demain|hoy|mañana|oggi|domani|vandaag)(?:\s+(?:at|saat|um|в|الساعة|à|a las|alle|om)\s+([0-2]?\d:[0-5]\d))?/iu,
  );
  const route = text.match(
    /(?:^|[\s,])(?:from|arasında|arasinda|von|от|من|de|desde|da|van)\s+(.{2,60}?)\s+(?:to|ile|arası|arasi|nach|до|إلى|الى|à|a|naar)\s+(.{2,60}?)(?=\s+(?:for|on|tarih|date|am|für|на|дата|في|le|el|il|op|today|tomorrow|bugün|bugun|yarın|yarin|heute|morgen|сегодня|завтра|اليوم|غدًا|غدا|aujourd’hui|aujourd'hui|demain|hoy|mañana|oggi|domani|vandaag)(?:\s|$)|\s+20\d{2}\b|[,.!?]|$)/iu,
  );
  const date = numericDate?.[1] ?? (
    relativeDate
      ? `${relativeDate[1]}${relativeDate[2] ? ` ${relativeDate[2]}` : ''}`
      : undefined
  );
  return {
    ready,
    details: {
      ...(route ? { route: `${route[1].trim()} - ${route[2].trim()}` } : {}),
      ...(date ? { date } : {}),
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