/**
 * db/seed-service-categories.ts
 *
 * Idempotent seed for service_categories table.
 * Inserts the 5 default categories with all 9-language translations.
 * Safe to run multiple times — uses ON CONFLICT (slug) DO NOTHING.
 *
 * Usage:  tsx db/seed-service-categories.ts
 * Also called automatically by the db:migrate script.
 */
import { db } from './index';
import { serviceCategories } from './schema';
import { sql } from 'drizzle-orm';

const SEED_CATEGORIES = [
  {
    slug:             'airport',
    nameTranslations: {
      tr: 'Havalimanı Transferleri',
      en: 'Airport Transfers',
      de: 'Flughafentransfers',
      ru: 'Трансферы в аэропорт',
      ar: 'نقل المطار',
      fr: 'Transferts Aéroport',
      es: 'Traslados al Aeropuerto',
      it: 'Transfer Aeroporto',
      nl: 'Luchthaventransfers',
    },
    sortOrder: 1,
  },
  {
    slug:             'city_vip',
    nameTranslations: {
      tr: 'VIP & Şehir İçi',
      en: 'VIP & City Services',
      de: 'VIP & Stadtdienste',
      ru: 'VIP и городские услуги',
      ar: 'خدمات VIP والمدينة',
      fr: 'VIP & Services Urbains',
      es: 'VIP & Servicios Urbanos',
      it: 'VIP & Servizi Urbani',
      nl: 'VIP & Stadsdiensten',
    },
    sortOrder: 2,
  },
  {
    slug:             'intercity',
    nameTranslations: {
      tr: 'Şehirlerarası Transfer',
      en: 'Intercity Transfer',
      de: 'Intercity-Transfer',
      ru: 'Межгородской трансфер',
      ar: 'نقل بين المدن',
      fr: 'Transfert Interurbain',
      es: 'Traslado Interurbano',
      it: 'Transfer Interurbano',
      nl: 'Intercitytransfer',
    },
    sortOrder: 3,
  },
  {
    slug:             'tour',
    nameTranslations: {
      tr: 'Günübirlik Turlar',
      en: 'Day Tours',
      de: 'Tagestouren',
      ru: 'Однодневные экскурсии',
      ar: 'جولات ليوم واحد',
      fr: "Excursions d'une Journée",
      es: 'Excursiones de un Día',
      it: 'Tour di un Giorno',
      nl: 'Dagtochten',
    },
    sortOrder: 4,
  },
  {
    slug:             'special',
    nameTranslations: {
      tr: 'Özel Hizmetler',
      en: 'Special Services',
      de: 'Sonderdienste',
      ru: 'Особые услуги',
      ar: 'الخدمات الخاصة',
      fr: 'Services Spéciaux',
      es: 'Servicios Especiales',
      it: 'Servizi Speciali',
      nl: 'Speciale Diensten',
    },
    sortOrder: 5,
  },
];

async function seed() {
  console.log('[seed-service-categories] Seeding service_categories…');

  for (const cat of SEED_CATEGORIES) {
    await db
      .insert(serviceCategories)
      .values({
        slug:             cat.slug,
        nameTranslations: cat.nameTranslations,
        sortOrder:        cat.sortOrder,
        isActive:         true,
      })
      .onConflictDoNothing();
    console.log(`  ✓  ${cat.slug} (sort_order=${cat.sortOrder})`);
  }

  console.log('[seed-service-categories] Done.');
  process.exit(0);
}

seed().catch(err => {
  console.error('[seed-service-categories] Error:', err);
  process.exit(1);
});
