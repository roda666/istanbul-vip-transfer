/** Authoritative, public Istanbul VIP Transfer fleet. */
const LANGS = ['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'];

function translations(name, description, tagline, passengers, luggage, category, requestOnly = false) {
  const names = name === 'Yarım otobüs'
    ? { tr: name, en: 'Midibus', de: 'Midibus', ru: 'Мидибус', ar: 'حافلة متوسطة', fr: 'Midibus', es: 'Midibús', it: 'Midibus', nl: 'Midibus' }
    : name === 'Otobüs'
      ? { tr: name, en: 'Coach', de: 'Reisebus', ru: 'Автобус', ar: 'حافلة', fr: 'Autocar', es: 'Autobús', it: 'Autobus', nl: 'Touringcar' }
      : Object.fromEntries(LANGS.map((lang) => [lang, name]));
  const kind = {
    minivan: ['VIP minivan', 'VIP-Minivan', 'VIP-минивэн', 'ميني فان VIP', 'minivan VIP', 'minivan VIP', 'minivan VIP', 'VIP-minivan'],
    minibus: ['Mercedes Sprinter minibus', 'Mercedes-Sprinter-Minibus', 'микроавтобус Mercedes Sprinter', 'ميني باص مرسيدس سبرنتر', 'minibus Mercedes Sprinter', 'minibús Mercedes Sprinter', 'minibus Mercedes Sprinter', 'Mercedes Sprinter-minibus'],
    midibus: ['midibus', 'Midibus', 'мидибус', 'حافلة متوسطة', 'midibus', 'midibús', 'midibus', 'midibus'],
    bus: ['coach', 'Reisebus', 'автобус', 'حافلة', 'autocar', 'autobús', 'autobus', 'touringcar'],
  }[category];
  const descriptions = requestOnly ? {
    tr: description,
    en: `${name}, offered on request for private transfers.`,
    de: `${name}, auf Anfrage für private Transfers verfügbar.`,
    ru: `${name}, доступен по запросу для частных трансферов.`,
    ar: `${name} متاح عند الطلب لخدمات النقل الخاصة.`,
    fr: `${name}, proposé sur demande pour les transferts privés.`,
    es: `${name}, disponible bajo petición para traslados privados.`,
    it: `${name}, disponibile su richiesta per trasferimenti privati.`,
    nl: `${name}, op aanvraag beschikbaar voor privétransfers.`,
  } : {
    tr: description,
    en: `Comfort-focused ${kind[0]} for up to ${passengers} passengers, with space for ${luggage} large suitcases.`,
    de: `Komfortorientierter ${kind[1]} für bis zu ${passengers} Fahrgäste, mit Platz für ${luggage} große Koffer.`,
    ru: `Комфортный ${kind[2]} для ${passengers} пассажиров, с местом для ${luggage} больших чемоданов.`,
    ar: `${kind[3]} مريح لما يصل إلى ${passengers} راكباً، مع سعة ${luggage} حقائب كبيرة.`,
    fr: `${kind[4]} confortable pour ${passengers} passagers, avec de la place pour ${luggage} grandes valises.`,
    es: `${kind[5]} cómodo para ${passengers} pasajeros, con espacio para ${luggage} maletas grandes.`,
    it: `${kind[6]} confortevole per ${passengers} passeggeri, con spazio per ${luggage} valigie grandi.`,
    nl: `Comfortabele ${kind[7]} voor ${passengers} passagiers, met ruimte voor ${luggage} grote koffers.`,
  };
  const taglines = {
    tr: tagline,
    en: requestOnly ? 'Available on Request' : category === 'minivan' ? 'Refined Minivan Comfort' : 'Premium Group Travel',
    de: requestOnly ? 'Auf Anfrage verfügbar' : category === 'minivan' ? 'Komfort im eleganten Minivan' : 'Premiumreisen für Gruppen',
    ru: requestOnly ? 'Доступно по запросу' : category === 'minivan' ? 'Изысканный комфорт минивэна' : 'Премиальные поездки для групп',
    ar: requestOnly ? 'متاح عند الطلب' : category === 'minivan' ? 'راحة ميني فان راقية' : 'رحلات جماعية فاخرة',
    fr: requestOnly ? 'Disponible sur demande' : category === 'minivan' ? 'Confort raffiné en minivan' : 'Voyage premium en groupe',
    es: requestOnly ? 'Disponible bajo petición' : category === 'minivan' ? 'Confort refinado en minivan' : 'Viajes premium en grupo',
    it: requestOnly ? 'Disponibile su richiesta' : category === 'minivan' ? 'Comfort raffinato in minivan' : 'Viaggi premium per gruppi',
    nl: requestOnly ? 'Beschikbaar op aanvraag' : category === 'minivan' ? 'Verfijnd minivancomfort' : 'Premium groepsvervoer',
  };
  return {
    nameTranslations: names,
    shortDescTranslations: descriptions,
    taglineTranslations: taglines,
  };
}

const standardFeatures = ['WIFI', 'CLIMATE', 'MEET_GREET'];

function vehicle({
  name, slug, description, tagline, passengers, luggage = passengers, type, image, alt, order,
  featured = false, priceCalculationEligible = true, pricingClass = type, features = standardFeatures,
  requestOnly = false,
}) {
  return {
    name, slug, shortDescription: description, passengerCapacity: passengers,
    luggageCapacity: luggage, vehicleType: type, coverImage: image,
    coverImageAlt: alt, features, displayOrder: order, isFeatured: featured,
    priceCalculationEligible, pricingClass, isActive: true, status: 'PUBLISHED',
    ...translations(name, description, tagline, passengers, luggage, type, requestOnly),
  };
}

export const VEHICLES = [
  vehicle({ name: 'Mercedes Vito', slug: 'mercedes-vito', description: '6 kişilik VIP minivan; şehir içi ve havalimanı transferlerinde konforlu seçim.', tagline: 'VIP Minivan Konforu', passengers: 6, luggage: 5, type: 'minivan', image: '/images/mercedes-vito.jpg', alt: 'Mercedes Vito 6 kişilik VIP minivan', order: 10 }),
  vehicle({ name: 'Volkswagen Transporter', slug: 'vw-transporter', description: '7 kişilik geniş ve konfor odaklı VIP minivan; küçük gruplar için ferah alternatif.', tagline: 'Geniş Minivan Konforu', passengers: 7, luggage: 6, type: 'minivan', image: '/images/vw-transporter.jpg', alt: 'Volkswagen Transporter 7 kişilik VIP minivan', order: 20 }),
  vehicle({ name: 'Mercedes Sprinter 10', slug: 'mercedes-sprinter-10', description: '10 kişilik Mercedes Sprinter minibüs; her yolcu için bir büyük bavul kapasitesi.', tagline: 'Küçük Grup Minibüsü', passengers: 10, type: 'minibus', image: '/images/vehicles/sprinter-10.jpg', alt: 'Mercedes Sprinter 10 kişilik minibüs', order: 30 }),
  vehicle({ name: 'Mercedes Sprinter 13', slug: 'mercedes-sprinter-vip', description: '13 kişilik Mercedes Sprinter minibüs; büyük bavullar için yolcu başına kapasite.', tagline: 'Grup Transfer Konforu', passengers: 13, type: 'minibus', image: '/images/mercedes-sprinter.jpg', alt: 'Mercedes Sprinter 13 kişilik minibüs', order: 40, featured: true }),
  vehicle({ name: 'Mercedes Sprinter 15', slug: 'mercedes-sprinter-15', description: '15 kişilik Mercedes Sprinter minibüs; her yolcu için bir büyük bavul kapasitesi.', tagline: 'Geniş Grup Minibüsü', passengers: 15, type: 'minibus', image: '/images/vehicles/sprinter-15.jpg', alt: 'Mercedes Sprinter 15 kişilik minibüs', order: 50 }),
  vehicle({ name: 'Mercedes Sprinter 19', slug: 'mercedes-sprinter-19', description: '19 kişilik Mercedes Sprinter minibüs; her yolcu için bir büyük bavul kapasitesi.', tagline: 'Büyük Grup Minibüsü', passengers: 19, type: 'minibus', image: '/images/vehicles/sprinter-19.jpg', alt: 'Mercedes Sprinter 19 kişilik minibüs', order: 60 }),
  vehicle({ name: 'Yarım otobüs', slug: 'midibus-25', description: '25 kişiye kadar yarım otobüs; her yolcu için bir büyük bavul kapasitesi.', tagline: 'Orta Ölçekli Grup', passengers: 25, type: 'midibus', image: '/images/vehicles/midibus-25.jpg', alt: '25 kişilik yarım otobüs', order: 70 }),
  vehicle({ name: 'Otobüs', slug: 'coach-45', description: '45 kişiye kadar otobüs; her yolcu için bir büyük bavul kapasitesi.', tagline: 'Büyük Grup Otobüsü', passengers: 45, type: 'bus', image: '/images/vehicles/coach-45.jpg', alt: '45 kişilik otobüs', order: 80 }),
  // These are request-only public options. Keep the existing images, but do not
  // claim trim-specific equipment or specifications that cannot be verified.
  vehicle({ name: 'Mercedes E-Class', slug: 'mercedes-e-class', description: 'Mercedes E-Class, özel transferler için talep üzerine sunulan sedan seçeneği.', tagline: 'Talep Üzerine Sedan', passengers: 4, luggage: 4, type: 'minivan', image: '/images/mercedes-e-class.jpg', alt: 'Mercedes E-Class sedan', order: 90, priceCalculationEligible: false, pricingClass: 'minivan', features: [], requestOnly: true }),
  vehicle({ name: 'Mercedes S-Class', slug: 'mercedes-s-class', description: 'Mercedes S-Class, özel transferler için talep üzerine sunulan sedan seçeneği.', tagline: 'Talep Üzerine Sedan', passengers: 4, luggage: 3, type: 'minivan', image: '/images/mercedes-s-class.jpg', alt: 'Mercedes S-Class sedan', order: 100, priceCalculationEligible: false, pricingClass: 'minivan', features: [], requestOnly: true }),
  vehicle({ name: 'Mercedes V-Class', slug: 'mercedes-v-class', description: 'Mercedes V-Class, özel transferler için talep üzerine sunulan araç seçeneği.', tagline: 'Talep Üzerine Araç', passengers: 7, luggage: 8, type: 'minivan', image: '/images/mercedes-v-class.jpg', alt: 'Mercedes V-Class', order: 110, priceCalculationEligible: false, pricingClass: 'minivan', features: [], requestOnly: true }),
];

export const ARCHIVED_SLUGS = [];