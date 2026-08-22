/**
 * Seed 8 initial transfer routes for the "Popüler Transfer Bölgeleri" section.
 * Idempotent — uses ON CONFLICT (slug) DO NOTHING so multiple runs are safe.
 *
 * Run:  npx tsx db/seed-transfer-routes.ts
 * Also invoked by:  pnpm db:migrate
 */
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: false, max: 1 });

const ROUTES = [
  {
    slug: 'taksim-sabiha',
    name: 'Taksim → Sabiha Gökçen Havalimanı',
    origin: 'Taksim',
    destination: 'Sabiha Gökçen Havalimanı',
    distanceKm: 55,
    durationMinutes: 70,
    priceVitoMinEur: 45,
    priceVitoMaxEur: 60,
    priceSprinterMinEur: 60,
    priceSprinterMaxEur: 80,
    imagePath: '/route-images/taksim-sabiha.jpg',
    displayOrder: 1,
  },
  {
    slug: 'sultanahmet-sabiha',
    name: 'Sultanahmet → Sabiha Gökçen Havalimanı',
    origin: 'Sultanahmet',
    destination: 'Sabiha Gökçen Havalimanı',
    distanceKm: 50,
    durationMinutes: 65,
    priceVitoMinEur: 45,
    priceVitoMaxEur: 60,
    priceSprinterMinEur: 60,
    priceSprinterMaxEur: 80,
    imagePath: '/route-images/sultanahmet-sabiha.jpg',
    displayOrder: 2,
  },
  {
    slug: 'ist-havalimani-taksim',
    name: 'İstanbul Havalimanı → Taksim / Beşiktaş / Sultanahmet',
    origin: 'İstanbul Havalimanı',
    destination: 'Taksim / Beşiktaş / Sultanahmet',
    distanceKm: 45,
    durationMinutes: 60,
    priceVitoMinEur: 40,
    priceVitoMaxEur: 55,
    priceSprinterMinEur: 55,
    priceSprinterMaxEur: 75,
    imagePath: '/route-images/ist-havalimani-taksim.jpg',
    displayOrder: 3,
  },
  {
    slug: 'tarabya-bogaz',
    name: 'Tarabya / Boğaz Otelleri Transferi',
    origin: 'Boğaz Otelleri (Tarabya)',
    destination: 'İstanbul Havalimanı / Sabiha Gökçen',
    distanceKm: 35,
    durationMinutes: 50,
    priceVitoMinEur: 35,
    priceVitoMaxEur: 50,
    priceSprinterMinEur: 50,
    priceSprinterMaxEur: 70,
    imagePath: '/route-images/tarabya-bogaz.jpg',
    displayOrder: 4,
  },
  {
    slug: 'istanbul-ankara',
    name: 'İstanbul → Ankara Şehirlerarası',
    origin: 'İstanbul',
    destination: 'Ankara',
    distanceKm: 450,
    durationMinutes: 280,
    priceVitoMinEur: 350,
    priceVitoMaxEur: 450,
    priceSprinterMinEur: 450,
    priceSprinterMaxEur: 580,
    imagePath: '/route-images/istanbul-ankara.jpg',
    displayOrder: 5,
  },
  {
    slug: 'istanbul-bodrum',
    name: 'İstanbul → Bodrum Şehirlerarası',
    origin: 'İstanbul',
    destination: 'Bodrum',
    distanceKm: 780,
    durationMinutes: 480,
    priceVitoMinEur: 550,
    priceVitoMaxEur: 700,
    priceSprinterMinEur: 700,
    priceSprinterMaxEur: 900,
    imagePath: '/route-images/istanbul-bodrum.jpg',
    displayOrder: 6,
  },
  {
    slug: 'istanbul-antalya',
    name: 'İstanbul → Antalya Şehirlerarası',
    origin: 'İstanbul',
    destination: 'Antalya',
    distanceKm: 700,
    durationMinutes: 420,
    priceVitoMinEur: 500,
    priceVitoMaxEur: 650,
    priceSprinterMinEur: 650,
    priceSprinterMaxEur: 850,
    imagePath: '/route-images/istanbul-antalya.jpg',
    displayOrder: 7,
  },
  {
    slug: 'istanbul-izmir',
    name: 'İstanbul → İzmir Şehirlerarası',
    origin: 'İstanbul',
    destination: 'İzmir',
    distanceKm: 480,
    durationMinutes: 300,
    priceVitoMinEur: 380,
    priceVitoMaxEur: 480,
    priceSprinterMinEur: 480,
    priceSprinterMaxEur: 620,
    imagePath: '/route-images/istanbul-izmir.jpg',
    displayOrder: 8,
  },
];

const ROUTE_LOCALE_COPY = {
  en: { title: 'Private VIP transfer', description: 'Travel comfortably with a professional chauffeur and a Mercedes Vito or Sprinter VIP vehicle, available around the clock.' },
  de: { title: 'Privater VIP-Transfer', description: 'Reisen Sie komfortabel mit professionellem Fahrer und einem Mercedes Vito oder Sprinter VIP Fahrzeug, rund um die Uhr verfügbar.' },
  ru: { title: 'Частный VIP-трансфер', description: 'Путешествуйте с комфортом с профессиональным водителем на Mercedes Vito или Sprinter VIP, доступном круглосуточно.' },
  ar: { title: 'نقل VIP خاص', description: 'سافر براحة مع سائق محترف وسيارة مرسيدس فيتو أو سبرينتر VIP متاحة على مدار الساعة.' },
  fr: { title: 'Transfert VIP privé', description: 'Voyagez confortablement avec un chauffeur professionnel et un véhicule Mercedes Vito ou Sprinter VIP, disponible 24h/24.' },
  es: { title: 'Traslado VIP privado', description: 'Viaje cómodamente con un conductor profesional y un vehículo Mercedes Vito o Sprinter VIP, disponible las 24 horas.' },
  it: { title: 'Trasferimento VIP privato', description: 'Viaggia comodamente con un autista professionista e un veicolo Mercedes Vito o Sprinter VIP, disponibile 24 ore su 24.' },
  nl: { title: 'Privé VIP-transfer', description: 'Reis comfortabel met een professionele chauffeur en een Mercedes Vito- of Sprinter VIP-voertuig, 24 uur per dag beschikbaar.' },
} as const;

function localizedPlace(value: string, locale: keyof typeof ROUTE_LOCALE_COPY) {
  const airport = {
    en: 'Istanbul Airport', de: 'Flughafen Istanbul', ru: 'Аэропорт Стамбула', ar: 'مطار إسطنبول',
    fr: 'Aéroport d’Istanbul', es: 'Aeropuerto de Estambul', it: 'Aeroporto di Istanbul', nl: 'Luchthaven Istanbul',
  }[locale];
  const sabiha = {
    en: 'Sabiha Gökçen Airport', de: 'Flughafen Sabiha Gökçen', ru: 'Аэропорт Сабиха Гёкчен', ar: 'مطار صبيحة كوكجن',
    fr: 'Aéroport Sabiha Gökçen', es: 'Aeropuerto Sabiha Gökçen', it: 'Aeroporto Sabiha Gökçen', nl: 'Luchthaven Sabiha Gökçen',
  }[locale];
  return value.replaceAll('İstanbul Havalimanı', airport).replaceAll('Sabiha Gökçen Havalimanı', sabiha).replaceAll('Şehirlerarası', '');
}

function relatedServiceSlug(slug: string) {
  if (slug.includes('sabiha')) return 'sabiha-gokcen-havalimani-transfer';
  if (slug.includes('havalimani')) return 'istanbul-havalimani-transfer';
  if (slug.includes('ankara')) return 'ankara-vip-transfer';
  if (slug.includes('antalya')) return 'antalya-vip-transfer';
  if (slug.includes('izmir')) return 'izmir-vip-transfer';
  if (slug.includes('bodrum')) return 'sehirler-arasi-transfer';
  return 'vip-transfer';
}

async function seed() {
  console.log('Seeding transfer routes…');
  for (const r of ROUTES) {
    await sql`
      INSERT INTO transfer_routes (
        slug, name, origin, destination, distance_km, duration_minutes,
        price_vito_min_eur, price_vito_max_eur,
        price_sprinter_min_eur, price_sprinter_max_eur,
        image_path, display_order, active, description, seo_title, seo_description,
        og_title, og_description, related_service_slug, indexable,
        created_at, updated_at
      ) VALUES (
        ${r.slug}, ${r.name}, ${r.origin}, ${r.destination},
        ${r.distanceKm}, ${r.durationMinutes},
        ${r.priceVitoMinEur}, ${r.priceVitoMaxEur},
        ${r.priceSprinterMinEur}, ${r.priceSprinterMaxEur},
        ${r.imagePath}, ${r.displayOrder}, true,
        ${r.origin + ' ile ' + r.destination + ' arasındaki VIP transferiniz için Mercedes Vito ve Sprinter araç seçenekleriyle, deneyimli şoförlerimiz 7/24 hizmetinizdedir.'},
        ${r.name + ' | İstanbul VIP Transfer'},
        ${r.origin + ' - ' + r.destination + ' VIP transferi için konforlu araç ve profesyonel şoför hizmeti.'},
        ${r.name + ' | İstanbul VIP Transfer'},
        ${r.origin + ' ile ' + r.destination + ' arasında güvenli ve konforlu VIP transfer.'},
        ${relatedServiceSlug(r.slug)}, true,
        now(), now()
      )
      ON CONFLICT (slug) DO NOTHING
    `;
    for (const [languageCode, copy] of Object.entries(ROUTE_LOCALE_COPY) as [keyof typeof ROUTE_LOCALE_COPY, typeof ROUTE_LOCALE_COPY[keyof typeof ROUTE_LOCALE_COPY]][]) {
      const origin = localizedPlace(r.origin, languageCode);
      const destination = localizedPlace(r.destination, languageCode);
      const title = `${copy.title}: ${origin} → ${destination}`;
      await sql`
        INSERT INTO transfer_route_translations (
          route_id, language_code, title, description, seo_title, seo_description,
          og_title, og_description, status, published_at, created_at, updated_at
        )
        SELECT id, ${languageCode}, ${title}, ${copy.description},
          ${title + ' | Istanbul VIP Transfer'}, ${copy.description},
          ${title + ' | Istanbul VIP Transfer'}, ${copy.description},
          'PUBLISHED', now(), now(), now()
        FROM transfer_routes WHERE slug = ${r.slug}
        ON CONFLICT (route_id, language_code) DO UPDATE
        SET title = EXCLUDED.title,
            description = EXCLUDED.description,
            seo_title = EXCLUDED.seo_title,
            seo_description = EXCLUDED.seo_description,
            og_title = EXCLUDED.og_title,
            og_description = EXCLUDED.og_description,
            status = 'PUBLISHED',
            published_at = now(),
            updated_at = now()
        -- Repair only the earlier automatic Turkish-title fallback. Existing
        -- editor-authored locale drafts are never overwritten by the seed.
        WHERE transfer_route_translations.status = 'DRAFT'
          AND transfer_route_translations.title = ${r.name}
      `;
    }
    console.log(`  ✓ ${r.name}`);
  }
  console.log('Done.');
  await sql.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
