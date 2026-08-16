/**
 * Seed the vehicles table with 6 VIP fleet vehicles and 9-language translations.
 * Run: node scripts/seed-vehicles.mjs
 */
import postgres from '../node_modules/postgres/src/index.js';
import OpenAI from '../node_modules/openai/index.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const LANGS = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'];

const VEHICLES = [
  {
    name: 'Mercedes Vito',
    slug: 'mercedes-vito',
    shortDescription: 'Şehir içi ve kısa mesafe transferler için ideal 7 kişilik lüks VIP minivan.',
    tagline: 'Kompakt Lüks',
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
  },
  {
    name: 'Mercedes Sprinter VIP',
    slug: 'mercedes-sprinter-vip',
    shortDescription: 'Büyük gruplar ve uzun yolculuklar için tasarlanmış 13 kişilik ultra-lüks VIP minibüs.',
    tagline: 'Büyük Grup Konforunun Zirvesi',
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
  },
  {
    name: 'Mercedes E-Class',
    slug: 'mercedes-e-class',
    shortDescription: 'İş seyahatlerinde tercih edilen 4 kişilik executive sedan. Gizlilik ve konfor bir arada.',
    tagline: 'Executive Sedan',
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
  },
  {
    name: 'Mercedes S-Class',
    slug: 'mercedes-s-class',
    shortDescription: 'Protokol ve VIP konuklar için 4 kişilik premium lüks sedan. Masaj koltuğu ve panoramik tavan.',
    tagline: 'Prestige Sınıfı',
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
  },
  {
    name: 'Mercedes V-Class',
    slug: 'mercedes-v-class',
    shortDescription: 'Aileler ve küçük gruplar için 7 kişilik yüksek tavanlı lüks MPV. Geniş bagaj kapasitesi.',
    tagline: 'Lüks Aile MPV',
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
  },
  {
    name: 'Volkswagen Transporter',
    slug: 'vw-transporter',
    shortDescription: 'Bütçe dostu grup transferleri için 8 kişilik rahat minivan. Güvenilir ve konforlu.',
    tagline: 'Grup Transferi',
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
  },
];

async function translateText(text, fromLang, toLang) {
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a professional translator specializing in luxury travel and VIP transportation. Translate the following Turkish text to ${toLang}. Return ONLY the translated text, no explanations or quotes.`,
      },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });
  return resp.choices[0]?.message?.content?.trim() ?? text;
}

const LANG_NAMES = {
  en: 'English',
  de: 'German',
  ru: 'Russian',
  ar: 'Arabic',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
};

async function translateVehicle(vehicle) {
  const nameTranslations = { tr: vehicle.name };
  const shortDescTranslations = { tr: vehicle.shortDescription };
  const taglineTranslations = { tr: vehicle.tagline };

  for (const lang of LANGS) {
    const langName = LANG_NAMES[lang];
    console.log(`  Translating ${vehicle.name} → ${langName}`);
    // Vehicle name stays the same (brand names are universal)
    nameTranslations[lang] = vehicle.name;
    // Translate description and tagline in parallel
    const [desc, tagline] = await Promise.all([
      translateText(vehicle.shortDescription, 'Turkish', langName),
      translateText(vehicle.tagline, 'Turkish', langName),
    ]);
    shortDescTranslations[lang] = desc;
    taglineTranslations[lang] = tagline;
  }

  return { nameTranslations, shortDescTranslations, taglineTranslations };
}

async function main() {
  console.log('🚗 Seeding vehicles table…\n');

  for (const v of VEHICLES) {
    console.log(`\n→ Processing: ${v.name}`);

    const translations = await translateVehicle(v);

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
        ${sql.json(translations.nameTranslations)},
        ${sql.json(translations.shortDescTranslations)},
        ${sql.json(translations.taglineTranslations)}
      )
      ON CONFLICT (slug) DO UPDATE SET
        short_description = EXCLUDED.short_description,
        passenger_capacity = EXCLUDED.passenger_capacity,
        luggage_capacity = EXCLUDED.luggage_capacity,
        features = EXCLUDED.features,
        display_order = EXCLUDED.display_order,
        is_featured = EXCLUDED.is_featured,
        status = EXCLUDED.status,
        name_translations = EXCLUDED.name_translations,
        short_desc_translations = EXCLUDED.short_desc_translations,
        tagline_translations = EXCLUDED.tagline_translations,
        updated_at = now()
    `;
    console.log(`  ✅ Saved ${v.name}`);
  }

  console.log('\n✅ Vehicle seeding complete!');
  await sql.end();
}

main().catch(e => { console.error(e); sql.end(); process.exit(1); });
