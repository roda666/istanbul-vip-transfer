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
  { name: 'İstanbul Havalimanı (IST)', slug: 'ist-havalimani', city: 'İstanbul', latitude: 41.2761476, longitude: 28.7287349, displayOrder: 1 },
  { name: 'Sabiha Gökçen Havalimanı (SAW)', slug: 'saw-sabiha-gokcen', city: 'İstanbul', latitude: 40.8944747, longitude: 29.3130928, displayOrder: 2 },
] as const;

const DISTRICTS = [
  ['Adalar', 40.8747, 29.1294],
  ['Arnavutköy', 41.2131248, 28.7198004],
  ['Ataşehir', 40.9874178, 29.1216176],
  ['Avcılar', 41.0153479, 28.7314618],
  ['Bağcılar', 41.0456474, 28.824722],
  ['Bahçelievler', 41.008545, 28.824722],
  ['Bakırköy', 40.9714189, 28.824722],
  ['Başakşehir', 41.0952059, 28.7932517],
  ['Bayrampaşa', 41.0481503, 28.9004553],
  ['Beşiktaş', 41.068616, 29.0285355],
  ['Beykoz', 41.1429436, 29.1782018],
  ['Beylikdüzü', 40.9910381, 28.6498144],
  ['Beyoğlu', 41.0382864, 28.9703304],
  ['Büyükçekmece', 41.0534024, 28.5564526],
  ['Çatalca', 41.142259, 28.457469],
  ['Çekmeköy', 41.104235, 29.3177272],
  ['Esenler', 41.0576987, 28.865506],
  ['Esenyurt', 41.0343177, 28.6614809],
  ['Eyüpsultan', 41.1871598, 28.8829816],
  ['Fatih', 41.0168639, 28.9470422],
  ['Gaziosmanpaşa', 41.0759477, 28.9004553],
  ['Güngören', 41.020546, 28.874244],
  ['Kadıköy', 40.9818744, 29.0576298],
  ['Kağıthane', 41.0814028, 28.9819731],
  ['Kartal', 40.9062892, 29.1972048],
  ['Küçükçekmece', 41.0212376, 28.7780987],
  ['Maltepe', 40.9498022, 29.1739513],
  ['Pendik', 40.9847981, 29.3482646],
  ['Sancaktepe', 41.0287028, 29.2901829],
  ['Sarıyer', 41.1814742, 29.0385466],
  ['Silivri', 41.073678, 28.247868],
  ['Sultanbeyli', 40.968423, 29.262008],
  ['Sultangazi', 41.1255794, 28.8713314],
  ['Şile', 41.174903, 29.609588],
  ['Şişli', 41.0536216, 28.9819731],
  ['Tuzla', 40.8982305, 29.3598782],
  ['Ümraniye', 41.0182327, 29.1274334],
  ['Üsküdar', 41.0189417, 29.0576298],
  ['Zeytinburnu', 40.990635, 28.89614],
] as const;

async function seed() {
  console.log('🌱 Seeding locations…');

  // Airports
  for (const airport of AIRPORTS) {
    await db.execute(sql`
      INSERT INTO locations (name, slug, city, type, pickup_enabled, dropoff_enabled, is_active, display_order, latitude, longitude, coordinate_source)
      VALUES (${airport.name}, ${airport.slug}, ${airport.city}, 'AIRPORT', true, true, true, ${airport.displayOrder},
        ${airport.latitude}, ${airport.longitude}, 'reference_seed')
      ON CONFLICT (slug) DO NOTHING
    `);
  }

  // Districts
  let order = 10;
  for (const [district, latitude, longitude] of DISTRICTS) {
    const slug = slugify(district);
    await db.execute(sql`
      INSERT INTO locations (name, slug, city, district, type, pickup_enabled, dropoff_enabled, is_active, display_order, latitude, longitude, coordinate_source)
      VALUES (${district}, ${slug}, 'İstanbul', ${district}, 'DISTRICT', true, true, true, ${order}, ${latitude}, ${longitude}, 'reference_seed')
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
