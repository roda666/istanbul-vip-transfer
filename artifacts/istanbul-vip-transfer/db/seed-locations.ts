/**
 * Idempotent seed for reservation locations.
 * Uses ON CONFLICT DO NOTHING so existing admin edits are preserved.
 * Run with: npx tsx db/seed-locations.ts
 */
import { db } from './index';
import { locations } from './schema';
import { sql } from 'drizzle-orm';

function slugify(val: string): string {
  return val
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const AIRPORTS = [
  { name: 'İstanbul Havalimanı (IST)', slug: 'ist-havalimani', city: 'İstanbul', displayOrder: 1 },
  { name: 'Sabiha Gökçen Havalimanı (SAW)', slug: 'saw-sabiha-gokcen', city: 'İstanbul', displayOrder: 2 },
] as const;

const DISTRICTS = [
  'Arnavutköy',
  'Ataşehir',
  'Avcılar',
  'Bağcılar',
  'Bahçelievler',
  'Bakırköy',
  'Başakşehir',
  'Bayrampaşa',
  'Beşiktaş',
  'Beykoz',
  'Beylikdüzü',
  'Beyoğlu',
  'Büyükçekmece',
  'Çatalca',
  'Çekmeköy',
  'Esenler',
  'Esenyurt',
  'Eyüpsultan',
  'Fatih',
  'Gaziosmanpaşa',
  'Güngören',
  'Kadıköy',
  'Kağıthane',
  'Kartal',
  'Küçükçekmece',
  'Maltepe',
  'Pendik',
  'Sancaktepe',
  'Sarıyer',
  'Şile',
  'Şişli',
  'Silivri',
  'Sultanbeyli',
  'Sultangazi',
  'Tuzla',
  'Ümraniye',
  'Üsküdar',
  'Zeytinburnu',
];

async function seed() {
  console.log('🌱 Seeding locations…');

  // Airports
  for (const airport of AIRPORTS) {
    await db.execute(sql`
      INSERT INTO locations (name, slug, city, type, pickup_enabled, dropoff_enabled, is_active, display_order)
      VALUES (${airport.name}, ${airport.slug}, ${airport.city}, 'AIRPORT', true, true, true, ${airport.displayOrder})
      ON CONFLICT (slug) DO NOTHING
    `);
  }

  // Districts
  let order = 10;
  for (const district of DISTRICTS) {
    const slug = slugify(district);
    await db.execute(sql`
      INSERT INTO locations (name, slug, city, district, type, pickup_enabled, dropoff_enabled, is_active, display_order)
      VALUES (${district}, ${slug}, 'İstanbul', ${district}, 'DISTRICT', true, true, true, ${order})
      ON CONFLICT (slug) DO NOTHING
    `);
    order += 10;
  }

  const [{ count }] = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*) AS count FROM locations WHERE archived_at IS NULL`
  );
  console.log(`✅ Done — ${count} active locations in database`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
