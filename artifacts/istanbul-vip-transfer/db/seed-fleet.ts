/**
 * Idempotent authoritative fleet convergence. It only touches fleet-owned
 * fields, retaining admin-entered long copy, SEO and gallery information.
 */
import postgres from 'postgres';
import { ARCHIVED_SLUGS, VEHICLES } from '../scripts/fleet-data.mjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL environment variable is not set.');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  for (const vehicle of VEHICLES) {
    await sql`
      INSERT INTO vehicles (
        name, slug, short_description, passenger_capacity, luggage_capacity,
        vehicle_type, cover_image, cover_image_alt, features, display_order,
        is_featured, status, name_translations, short_desc_translations,
        tagline_translations, published_at
      ) VALUES (
        ${vehicle.name}, ${vehicle.slug}, ${vehicle.shortDescription},
        ${vehicle.passengerCapacity}, ${vehicle.luggageCapacity}, ${vehicle.vehicleType},
        ${vehicle.coverImage}, ${vehicle.coverImageAlt}, ${sql.json(vehicle.features)},
        ${vehicle.displayOrder}, ${vehicle.isFeatured}, 'PUBLISHED',
        ${sql.json(vehicle.nameTranslations)}, ${sql.json(vehicle.shortDescTranslations)},
        ${sql.json(vehicle.taglineTranslations)}, now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        short_description = EXCLUDED.short_description,
        passenger_capacity = EXCLUDED.passenger_capacity,
        luggage_capacity = EXCLUDED.luggage_capacity,
        vehicle_type = EXCLUDED.vehicle_type,
        cover_image = EXCLUDED.cover_image,
        cover_image_alt = EXCLUDED.cover_image_alt,
        features = EXCLUDED.features,
        display_order = EXCLUDED.display_order,
        is_featured = EXCLUDED.is_featured,
        status = 'PUBLISHED',
        name_translations = EXCLUDED.name_translations,
        short_desc_translations = EXCLUDED.short_desc_translations,
        tagline_translations = EXCLUDED.tagline_translations,
        archived_at = NULL,
        updated_at = now()
    `;
  }
  await sql`UPDATE vehicles SET status = 'ARCHIVED', archived_at = now(), updated_at = now()
    WHERE slug IN ${sql(ARCHIVED_SLUGS)} AND status <> 'ARCHIVED'`;
} finally {
  await sql.end();
}