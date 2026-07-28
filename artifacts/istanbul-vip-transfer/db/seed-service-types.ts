/**
 * Seeds the 4 system service types for the booking form.
 * Idempotent — uses ON CONFLICT DO NOTHING.
 * Run: npx tsx db/seed-service-types.ts
 */
import { db } from './index';
import { serviceTypes } from './schema';
import { sql } from 'drizzle-orm';

const SERVICE_TYPES = [
  {
    key: 'AIRPORT_TRANSFER',
    label: 'Havalimanı / Şehir İçi Transfer',
    description: 'İstanbul havalimanlarından şehir içi lokasyonlara veya tersi yönde transfer.',
    enabled: true,
    quoteEnabled: true,
    reservationEnabled: true,
    displayOrder: 0,
  },
  {
    key: 'INTERCITY',
    label: 'Şehirler Arası Transfer',
    description: 'İstanbul ve diğer iller arasında konforlu şehirlerarası transfer.',
    enabled: true,
    quoteEnabled: true,
    reservationEnabled: true,
    displayOrder: 1,
  },
  {
    key: 'ALLOCATION',
    label: 'Araç Tahsisi',
    description: 'Saatlik veya günlük özel araç ve şoför tahsisi.',
    enabled: true,
    quoteEnabled: true,
    reservationEnabled: true,
    displayOrder: 2,
  },
  {
    key: 'TOUR',
    label: 'Özel Tur / Gezi',
    description: 'İstanbul ve çevresi için özel tur ve gezi organizasyonu.',
    enabled: true,
    quoteEnabled: true,
    reservationEnabled: true,
    displayOrder: 3,
  },
];

async function run() {
  console.log('🌱 Seeding service types…');

  for (const st of SERVICE_TYPES) {
    await db
      .insert(serviceTypes)
      .values(st)
      .onConflictDoNothing({ target: serviceTypes.key });
  }

  const rows = await db.select({ key: serviceTypes.key }).from(serviceTypes);
  console.log(`✅ Done — ${rows.length} service types in database`);
  console.log(rows.map((r) => `  ${r.key}`).join('\n'));
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed service types failed:', err);
  process.exit(1);
});
