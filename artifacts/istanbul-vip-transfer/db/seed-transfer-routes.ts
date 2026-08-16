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

async function seed() {
  console.log('Seeding transfer routes…');
  for (const r of ROUTES) {
    await sql`
      INSERT INTO transfer_routes (
        slug, name, origin, destination, distance_km, duration_minutes,
        price_vito_min_eur, price_vito_max_eur,
        price_sprinter_min_eur, price_sprinter_max_eur,
        image_path, display_order, active,
        created_at, updated_at
      ) VALUES (
        ${r.slug}, ${r.name}, ${r.origin}, ${r.destination},
        ${r.distanceKm}, ${r.durationMinutes},
        ${r.priceVitoMinEur}, ${r.priceVitoMaxEur},
        ${r.priceSprinterMinEur}, ${r.priceSprinterMaxEur},
        ${r.imagePath}, ${r.displayOrder}, true,
        now(), now()
      )
      ON CONFLICT (slug) DO NOTHING
    `;
    console.log(`  ✓ ${r.name}`);
  }
  console.log('Done.');
  await sql.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
