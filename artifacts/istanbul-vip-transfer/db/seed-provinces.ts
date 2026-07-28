/**
 * Seeds all 81 Turkish provinces as PROVINCE-type, INTERCITY-scope locations.
 * Idempotent — uses ON CONFLICT (slug) DO NOTHING.
 * Run: npx tsx db/seed-provinces.ts
 */
import { db } from './index';
import { locations } from './schema';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// 81 provinces ordered by plate number
const PROVINCES = [
  'Adana',
  'Adıyaman',
  'Afyonkarahisar',
  'Ağrı',
  'Amasya',
  'Ankara',
  'Antalya',
  'Artvin',
  'Aydın',
  'Balıkesir',
  'Bilecik',
  'Bingöl',
  'Bitlis',
  'Bolu',
  'Burdur',
  'Bursa',
  'Çanakkale',
  'Çankırı',
  'Çorum',
  'Denizli',
  'Diyarbakır',
  'Edirne',
  'Elazığ',
  'Erzincan',
  'Erzurum',
  'Eskişehir',
  'Gaziantep',
  'Giresun',
  'Gümüşhane',
  'Hakkari',
  'Hatay',
  'Isparta',
  'Mersin',
  'İstanbul',
  'İzmir',
  'Kars',
  'Kastamonu',
  'Kayseri',
  'Kırklareli',
  'Kırşehir',
  'Kocaeli',
  'Konya',
  'Kütahya',
  'Malatya',
  'Manisa',
  'Kahramanmaraş',
  'Mardin',
  'Muğla',
  'Muş',
  'Nevşehir',
  'Niğde',
  'Ordu',
  'Rize',
  'Sakarya',
  'Samsun',
  'Siirt',
  'Sinop',
  'Sivas',
  'Tekirdağ',
  'Tokat',
  'Trabzon',
  'Tunceli',
  'Şanlıurfa',
  'Uşak',
  'Van',
  'Yozgat',
  'Zonguldak',
  'Aksaray',
  'Bayburt',
  'Karaman',
  'Kırıkkale',
  'Batman',
  'Şırnak',
  'Bartın',
  'Ardahan',
  'Iğdır',
  'Yalova',
  'Karabük',
  'Kilis',
  'Osmaniye',
  'Düzce',
];

async function run() {
  console.log('🌱 Seeding 81 Turkish provinces…');

  // Build province records; use "il-<slug>" prefix to avoid slug collision
  // with any existing Istanbul-local location names.
  const records = PROVINCES.map((name, i) => ({
    name,
    slug: `il-${slugify(name)}`,
    city: name,
    district: null,
    type: 'PROVINCE' as const,
    scope: 'INTERCITY' as const,
    pickupEnabled: true,
    dropoffEnabled: true,
    isActive: true,
    displayOrder: i + 1, // plate number order (1-based)
  }));

  let inserted = 0;
  for (const rec of records) {
    const result = await db
      .insert(locations)
      .values(rec)
      .onConflictDoNothing({ target: locations.slug });
    // @ts-ignore — rowCount available on pg result
    if (result.rowCount !== 0) inserted++;
  }

  // Verify count
  const { count } = await import('drizzle-orm');
  const { eq, isNull } = await import('drizzle-orm');
  const rows = await db
    .select({ n: count() })
    .from(locations)
    .where(eq(locations.type, 'PROVINCE'));

  const total = Number(rows[0]?.n ?? 0);
  console.log(`✅ Done — ${inserted} provinces inserted, ${total} total PROVINCE records in database`);

  if (total !== 81) {
    console.warn(`⚠️  Expected 81 provinces but found ${total}. Check for duplicates.`);
  } else {
    console.log('✓ Exactly 81 unique provinces confirmed.');
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Province seed failed:', err);
  process.exit(1);
});
