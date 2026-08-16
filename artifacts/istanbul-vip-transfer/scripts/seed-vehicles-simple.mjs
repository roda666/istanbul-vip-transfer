/**
 * Simple vehicle seed — pre-written translations, no OpenAI calls.
 * Run: node scripts/seed-vehicles-simple.mjs
 */
import postgres from '../node_modules/postgres/src/index.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 2, idle_timeout: 0 });

const VEHICLES = [
  {
    name: 'Mercedes Vito',
    slug: 'mercedes-vito',
    shortDescription: 'Şehir içi ve kısa mesafe transferler için ideal 7 kişilik lüks VIP minivan.',
    passengerCapacity: 7,
    luggageCapacity: 7,
    vehicleType: 'MINIVAN',
    coverImage: '/images/mercedes-vito.jpg',
    coverImageAlt: 'Beyaz Mercedes Vito VIP transfer aracı',
    features: [
      { icon: 'WIFI', label: 'WiFi' },
      { icon: 'CLIMATE', label: 'Klima' },
      { icon: 'MEET_GREET', label: 'Meet & Greet' },
      { icon: 'LEATHER', label: 'Deri Koltuk' },
    ],
    displayOrder: 10,
    isFeatured: false,
    nameTranslations: {
      tr: 'Mercedes Vito', en: 'Mercedes Vito', de: 'Mercedes Vito',
      ru: 'Mercedes Vito', ar: 'Mercedes Vito', fr: 'Mercedes Vito',
      es: 'Mercedes Vito', it: 'Mercedes Vito', nl: 'Mercedes Vito',
    },
    shortDescTranslations: {
      tr: 'Şehir içi ve kısa mesafe transferler için ideal 7 kişilik lüks VIP minivan.',
      en: 'Ideal 7-seater luxury VIP minivan for city and short-distance transfers.',
      de: 'Ideales Luxus-VIP-Minivan mit 7 Sitzen für Stadtfahrten und Kurzstrecken.',
      ru: 'Идеальный 7-местный роскошный VIP-минивэн для городских и коротких трансферов.',
      ar: 'ميني فان VIP فاخر من 7 مقاعد مثالي لنقل المدينة والمسافات القصيرة.',
      fr: 'Minivan VIP luxueux 7 places idéal pour les transferts urbains et courtes distances.',
      es: 'Minivan VIP de lujo de 7 plazas ideal para traslados urbanos y de corta distancia.',
      it: 'Minivan VIP di lusso a 7 posti, ideale per trasferimenti in città e breve distanza.',
      nl: 'Ideale luxe 7-persoons VIP-minibus voor stedelijk en korte-afstandstransport.',
    },
    taglineTranslations: {
      tr: 'Kompakt Lüks', en: 'Compact Luxury', de: 'Kompakter Luxus',
      ru: 'Компактная роскошь', ar: 'الفخامة المدمجة', fr: 'Luxe Compact',
      es: 'Lujo Compacto', it: 'Lusso Compatto', nl: 'Compacte Luxe',
    },
  },
  {
    name: 'Mercedes Sprinter VIP',
    slug: 'mercedes-sprinter-vip',
    shortDescription: 'Büyük gruplar ve uzun yolculuklar için tasarlanmış 13 kişilik ultra-lüks VIP minibüs.',
    passengerCapacity: 13,
    luggageCapacity: 13,
    vehicleType: 'MINIBUS',
    coverImage: '/images/mercedes-sprinter.jpg',
    coverImageAlt: 'Beyaz Mercedes Sprinter VIP transfer aracı',
    features: [
      { icon: 'WIFI', label: 'WiFi' },
      { icon: 'CLIMATE', label: 'Klima' },
      { icon: 'MEET_GREET', label: 'Meet & Greet' },
      { icon: 'LUXURY', label: 'Lüks İç Mekan' },
      { icon: 'WATER', label: 'İkram Servisi' },
    ],
    displayOrder: 20,
    isFeatured: true,
    nameTranslations: {
      tr: 'Mercedes Sprinter VIP', en: 'Mercedes Sprinter VIP', de: 'Mercedes Sprinter VIP',
      ru: 'Mercedes Sprinter VIP', ar: 'Mercedes Sprinter VIP', fr: 'Mercedes Sprinter VIP',
      es: 'Mercedes Sprinter VIP', it: 'Mercedes Sprinter VIP', nl: 'Mercedes Sprinter VIP',
    },
    shortDescTranslations: {
      tr: 'Büyük gruplar ve uzun yolculuklar için tasarlanmış 13 kişilik ultra-lüks VIP minibüs.',
      en: '13-seater ultra-luxury VIP minibus designed for large groups and long journeys.',
      de: 'Ultra-luxuriöser VIP-Minibus mit 13 Sitzen für Großgruppen und Langstrecken.',
      ru: '13-местный ультра-роскошный VIP-микроавтобус для больших групп и дальних поездок.',
      ar: 'ميني باص VIP فائق الفخامة من 13 مقعداً مصمم للمجموعات الكبيرة والرحلات الطويلة.',
      fr: 'Minibus VIP ultra-luxueux 13 places conçu pour les grands groupes et longs trajets.',
      es: 'Minibús VIP ultra-lujoso de 13 plazas para grupos grandes y viajes largos.',
      it: 'Minibus VIP ultra-lusso a 13 posti per grandi gruppi e lunghi percorsi.',
      nl: 'Ultra-luxe 13-persoons VIP-minibus voor grote groepen en lange reizen.',
    },
    taglineTranslations: {
      tr: 'Büyük Grup Konforunun Zirvesi', en: 'Peak Large-Group Comfort', de: 'Höchster Komfort für Gruppen',
      ru: 'Высший комфорт для больших групп', ar: 'ذروة راحة المجموعات الكبيرة', fr: 'Confort Ultime en Grand Groupe',
      es: 'Máximo Confort en Grupo Grande', it: 'Massimo Comfort per Grandi Gruppi', nl: 'Topcomfort voor Grote Groepen',
    },
  },
  {
    name: 'Mercedes E-Class',
    slug: 'mercedes-e-class',
    shortDescription: 'İş seyahatlerinde tercih edilen 4 kişilik executive sedan. Gizlilik ve konfor bir arada.',
    passengerCapacity: 4,
    luggageCapacity: 4,
    vehicleType: 'SEDAN',
    coverImage: '/images/mercedes-e-class.jpg',
    coverImageAlt: 'Siyah Mercedes E-Class executive sedan VIP transfer',
    features: [
      { icon: 'WIFI', label: 'WiFi' },
      { icon: 'CLIMATE', label: 'Klima' },
      { icon: 'MEET_GREET', label: 'Meet & Greet' },
      { icon: 'LEATHER', label: 'Deri Koltuk' },
    ],
    displayOrder: 30,
    isFeatured: false,
    nameTranslations: {
      tr: 'Mercedes E-Class', en: 'Mercedes E-Class', de: 'Mercedes E-Klasse',
      ru: 'Mercedes E-Class', ar: 'مرسيدس فئة E', fr: 'Mercedes Classe E',
      es: 'Mercedes Clase E', it: 'Mercedes Classe E', nl: 'Mercedes E-Klasse',
    },
    shortDescTranslations: {
      tr: 'İş seyahatlerinde tercih edilen 4 kişilik executive sedan. Gizlilik ve konfor bir arada.',
      en: 'Preferred 4-seater executive sedan for business travel. Privacy and comfort combined.',
      de: 'Bevorzugte Executive-Limousine mit 4 Sitzen für Geschäftsreisen. Privatsphäre und Komfort vereint.',
      ru: 'Предпочтительный 4-местный представительский седан для деловых поездок. Приватность и комфорт вместе.',
      ar: 'سيدان تنفيذي من 4 مقاعد مفضل لرحلات العمل. الخصوصية والراحة معاً.',
      fr: 'Berline executive 4 places prisée pour les voyages d\'affaires. Intimité et confort réunis.',
      es: 'Sedán ejecutivo de 4 plazas preferido para viajes de negocios. Privacidad y confort combinados.',
      it: 'Berlina executive a 4 posti preferita per i viaggi d\'affari. Privacy e comfort combinati.',
      nl: 'Voorkeurs executive sedan met 4 zitplaatsen voor zakenreizen. Privacy en comfort gecombineerd.',
    },
    taglineTranslations: {
      tr: 'Executive Sedan', en: 'Executive Sedan', de: 'Executive Limousine',
      ru: 'Представительский седан', ar: 'سيدان تنفيذي', fr: 'Berline Executive',
      es: 'Sedán Ejecutivo', it: 'Berlina Executive', nl: 'Executive Sedan',
    },
  },
  {
    name: 'Mercedes S-Class',
    slug: 'mercedes-s-class',
    shortDescription: 'Protokol ve VIP konuklar için 4 kişilik premium lüks sedan. Masaj koltuğu ve panoramik tavan.',
    passengerCapacity: 4,
    luggageCapacity: 3,
    vehicleType: 'SEDAN',
    coverImage: '/images/mercedes-s-class.jpg',
    coverImageAlt: 'Siyah Mercedes S-Class prestige sedan VIP transfer',
    features: [
      { icon: 'WIFI', label: 'WiFi' },
      { icon: 'CLIMATE', label: 'Masaj & Klima' },
      { icon: 'MEET_GREET', label: 'Meet & Greet' },
      { icon: 'LUXURY', label: 'Premium İç Mekan' },
      { icon: 'WATER', label: 'İkram Servisi' },
    ],
    displayOrder: 40,
    isFeatured: false,
    nameTranslations: {
      tr: 'Mercedes S-Class', en: 'Mercedes S-Class', de: 'Mercedes S-Klasse',
      ru: 'Mercedes S-Class', ar: 'مرسيدس فئة S', fr: 'Mercedes Classe S',
      es: 'Mercedes Clase S', it: 'Mercedes Classe S', nl: 'Mercedes S-Klasse',
    },
    shortDescTranslations: {
      tr: 'Protokol ve VIP konuklar için 4 kişilik premium lüks sedan. Masaj koltuğu ve panoramik tavan.',
      en: '4-seater premium luxury sedan for protocol and VIP guests. Massage seat and panoramic roof.',
      de: 'Premium-Luxuslimousine mit 4 Sitzen für Protokoll und VIP-Gäste. Massagesitz und Panoramadach.',
      ru: '4-местный премиум-люкс седан для протокольных и VIP-гостей. Кресло с массажем и панорамная крыша.',
      ar: 'سيدان فاخر من 4 مقاعد للبروتوكول وضيوف VIP. مقعد تدليك وسقف بانورامي.',
      fr: 'Berline luxe premium 4 places pour protocole et invités VIP. Siège massant et toit panoramique.',
      es: 'Sedán de lujo premium de 4 plazas para protocolo e invitados VIP. Asiento de masaje y techo panorámico.',
      it: 'Berlina lusso premium a 4 posti per protocollo e ospiti VIP. Sedile massaggiante e tetto panoramico.',
      nl: 'Premium luxe sedan met 4 zitplaatsen voor protocol en VIP-gasten. Massagestoel en panoramisch dak.',
    },
    taglineTranslations: {
      tr: 'Prestige Sınıfı', en: 'Prestige Class', de: 'Prestige Klasse',
      ru: 'Класс Престиж', ar: 'درجة البريستيج', fr: 'Classe Prestige',
      es: 'Clase Prestige', it: 'Classe Prestige', nl: 'Prestige Klasse',
    },
  },
  {
    name: 'Mercedes V-Class',
    slug: 'mercedes-v-class',
    shortDescription: 'Aileler ve küçük gruplar için 7 kişilik yüksek tavanlı lüks MPV. Geniş bagaj kapasitesi.',
    passengerCapacity: 7,
    luggageCapacity: 8,
    vehicleType: 'MPV',
    coverImage: '/images/mercedes-v-class.jpg',
    coverImageAlt: 'Siyah Mercedes V-Class lüks MPV VIP transfer',
    features: [
      { icon: 'WIFI', label: 'WiFi' },
      { icon: 'CLIMATE', label: 'Çift Klima' },
      { icon: 'MEET_GREET', label: 'Meet & Greet' },
      { icon: 'LEATHER', label: 'Deri Koltuk' },
    ],
    displayOrder: 50,
    isFeatured: false,
    nameTranslations: {
      tr: 'Mercedes V-Class', en: 'Mercedes V-Class', de: 'Mercedes V-Klasse',
      ru: 'Mercedes V-Class', ar: 'مرسيدس فئة V', fr: 'Mercedes Classe V',
      es: 'Mercedes Clase V', it: 'Mercedes Classe V', nl: 'Mercedes V-Klasse',
    },
    shortDescTranslations: {
      tr: 'Aileler ve küçük gruplar için 7 kişilik yüksek tavanlı lüks MPV. Geniş bagaj kapasitesi.',
      en: 'Luxury 7-seater high-roof MPV for families and small groups. Large luggage capacity.',
      de: 'Luxuriöser 7-Sitzer Hochdach-MPV für Familien und Kleingruppen. Großes Gepäckvolumen.',
      ru: 'Роскошный 7-местный MPV с высокой крышей для семей и малых групп. Большой объем багажника.',
      ar: 'MPV فاخر من 7 مقاعد بسقف عالٍ للعائلات والمجموعات الصغيرة. سعة تخزين كبيرة للأمتعة.',
      fr: 'MPV luxueux 7 places à toit surélevé pour familles et petits groupes. Grande capacité de bagages.',
      es: 'Lujoso MPV de 7 plazas con techo alto para familias y grupos pequeños. Gran capacidad de equipaje.',
      it: 'MPV di lusso a 7 posti con tetto alto per famiglie e piccoli gruppi. Grande capacità bagagli.',
      nl: 'Luxe MPV met hoog dak en 7 zitplaatsen voor gezinnen en kleine groepen. Grote bagagecapaciteit.',
    },
    taglineTranslations: {
      tr: 'Lüks Aile MPV', en: 'Luxury Family MPV', de: 'Luxus-Familien-MPV',
      ru: 'Роскошный семейный MPV', ar: 'MPV عائلي فاخر', fr: 'MPV Familial Luxe',
      es: 'MPV Familiar de Lujo', it: 'MPV Familiare di Lusso', nl: 'Luxe Familie MPV',
    },
  },
  {
    name: 'Volkswagen Transporter',
    slug: 'vw-transporter',
    shortDescription: 'Bütçe dostu grup transferleri için 8 kişilik rahat minivan. Güvenilir ve konforlu.',
    passengerCapacity: 8,
    luggageCapacity: 8,
    vehicleType: 'MINIVAN',
    coverImage: '/images/vw-transporter.jpg',
    coverImageAlt: 'Gümüş Volkswagen Transporter grup transfer aracı',
    features: [
      { icon: 'CLIMATE', label: 'Klima' },
      { icon: 'MEET_GREET', label: 'Meet & Greet' },
      { icon: 'WIFI', label: 'WiFi' },
    ],
    displayOrder: 60,
    isFeatured: false,
    nameTranslations: {
      tr: 'Volkswagen Transporter', en: 'Volkswagen Transporter', de: 'Volkswagen Transporter',
      ru: 'Volkswagen Transporter', ar: 'فولكس واجن ترانسبورتر', fr: 'Volkswagen Transporter',
      es: 'Volkswagen Transporter', it: 'Volkswagen Transporter', nl: 'Volkswagen Transporter',
    },
    shortDescTranslations: {
      tr: 'Bütçe dostu grup transferleri için 8 kişilik rahat minivan. Güvenilir ve konforlu.',
      en: 'Comfortable 8-seater minivan for budget-friendly group transfers. Reliable and comfortable.',
      de: 'Komfortabler 8-Sitzer-Minivan für günstige Gruppenreisen. Zuverlässig und komfortabel.',
      ru: 'Комфортный 8-местный минивэн для экономичных групповых трансферов. Надежный и удобный.',
      ar: 'ميني فان مريح من 8 مقاعد لنقل المجموعات بأسعار معقولة. موثوق ومريح.',
      fr: 'Minivan confortable 8 places pour les transferts de groupe économiques. Fiable et confortable.',
      es: 'Minivan cómoda de 8 plazas para traslados grupales económicos. Fiable y confortable.',
      it: 'Minivan confortevole a 8 posti per trasferimenti di gruppo economici. Affidabile e confortevole.',
      nl: 'Comfortabele 8-persoons minibus voor voordelig groepstransport. Betrouwbaar en comfortabel.',
    },
    taglineTranslations: {
      tr: 'Grup Transferi', en: 'Group Transfer', de: 'Gruppenreise',
      ru: 'Групповой трансфер', ar: 'نقل المجموعات', fr: 'Transfert de Groupe',
      es: 'Traslado en Grupo', it: 'Trasferimento di Gruppo', nl: 'Groepstransport',
    },
  },
];

async function main() {
  console.log('🚗 Seeding vehicles table (pre-written translations)…\n');

  for (const v of VEHICLES) {
    await sql`
      INSERT INTO vehicles (
        name, slug, short_description, passenger_capacity, luggage_capacity,
        vehicle_type, cover_image, cover_image_alt, features, display_order,
        is_featured, status,
        name_translations, short_desc_translations, tagline_translations
      )
      VALUES (
        ${v.name}, ${v.slug}, ${v.shortDescription},
        ${v.passengerCapacity}, ${v.luggageCapacity},
        ${v.vehicleType}, ${v.coverImage}, ${v.coverImageAlt},
        ${sql.json(v.features)}, ${v.displayOrder}, ${v.isFeatured}, 'PUBLISHED',
        ${sql.json(v.nameTranslations)},
        ${sql.json(v.shortDescTranslations)},
        ${sql.json(v.taglineTranslations)}
      )
      ON CONFLICT (slug) DO UPDATE SET
        short_description          = EXCLUDED.short_description,
        passenger_capacity         = EXCLUDED.passenger_capacity,
        luggage_capacity           = EXCLUDED.luggage_capacity,
        features                   = EXCLUDED.features,
        display_order              = EXCLUDED.display_order,
        is_featured                = EXCLUDED.is_featured,
        status                     = EXCLUDED.status,
        name_translations          = EXCLUDED.name_translations,
        short_desc_translations    = EXCLUDED.short_desc_translations,
        tagline_translations       = EXCLUDED.tagline_translations,
        updated_at                 = now()
    `;
    console.log(`  ✅ ${v.name}`);
  }

  console.log('\n✅ Vehicle seeding complete!');
  await sql.end();
}

main().catch(e => { console.error(e); sql.end(); process.exit(1); });
