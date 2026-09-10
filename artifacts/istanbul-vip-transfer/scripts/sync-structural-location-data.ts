import 'server-only';

import { and, eq, isNull, or } from 'drizzle-orm';

import { db } from '../db';
import { locations } from '../db/schema';
import { AUTO_TRANSLATION_LOCALES } from '../lib/ai/fill-missing-translations';
import { translateServicePageFields } from '../lib/ai/translate-service-page';

type LocationTranslation = { name?: string; city?: string; district?: string | null };
type TranslationMap = Record<string, LocationTranslation>;

const CHUNK_SIZE = 12;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function main() {
  await db.insert(locations).values({
    name: 'Adalar',
    slug: 'adalar',
    city: 'İstanbul',
    district: 'Adalar',
    latitude: 40.8747,
    longitude: 29.1294,
    coordinateSource: 'reference_seed',
    type: 'DISTRICT',
    scope: 'BOTH',
    pickupEnabled: true,
    dropoffEnabled: true,
    isActive: true,
    displayOrder: 10,
    translations: {},
  }).onConflictDoUpdate({
    target: locations.slug,
    set: {
      city: 'İstanbul',
      district: 'Adalar',
      latitude: 40.8747,
      longitude: 29.1294,
      coordinateSource: 'reference_seed',
      type: 'DISTRICT',
      scope: 'BOTH',
      pickupEnabled: true,
      dropoffEnabled: true,
      isActive: true,
      archivedAt: null,
      updatedAt: new Date(),
    },
  });

  const activeRows = await db.select({
    id: locations.id,
    name: locations.name,
    city: locations.city,
    district: locations.district,
    translations: locations.translations,
  }).from(locations).where(isNull(locations.archivedAt));
  const rows = activeRows.filter(row => AUTO_TRANSLATION_LOCALES.some(locale => {
    const translated = (row.translations ?? {})[locale];
    return !translated?.name?.trim()
      || !translated.city?.trim()
      || Boolean(row.district && !translated.district?.trim());
  }));

  let completed = 0;
  for (const batch of chunks(rows, CHUNK_SIZE)) {
    const next = new Map(batch.map(row => [
      row.id,
      structuredClone((row.translations ?? {}) as TranslationMap),
    ]));

    await Promise.all(AUTO_TRANSLATION_LOCALES.map(async locale => {
      const fields: Record<string, string> = {};
      batch.forEach((row, index) => {
        fields[`r${index}_name`] = row.name;
        fields[`r${index}_city`] = row.city;
        if (row.district) fields[`r${index}_district`] = row.district;
      });
      const response = await translateServicePageFields(fields, locale);
      if (!response.ok) throw new Error(`${locale}: ${response.message ?? response.reason}`);

      batch.forEach((row, index) => {
        const name = response.translated[`r${index}_name`]?.trim();
        const city = response.translated[`r${index}_city`]?.trim();
        const district = row.district ? response.translated[`r${index}_district`]?.trim() : null;
        if (!name || !city || (row.district && !district)) {
          throw new Error(`${locale}: ${row.id} için eksik yapısal çeviri`);
        }
        next.get(row.id)![locale] = { name, city, district };
      });
    }));

    await db.transaction(async tx => {
      for (const row of batch) {
        await tx.update(locations).set({
          translations: next.get(row.id)!,
          updatedAt: new Date(),
        }).where(eq(locations.id, row.id));
      }
    });
    completed += batch.length;
    console.log(`Lokasyon çevirileri: ${completed}/${rows.length}`);
  }

  const invalid = await db.select({ id: locations.id }).from(locations).where(and(
    isNull(locations.archivedAt),
    or(isNull(locations.latitude), isNull(locations.longitude)),
  ));
  if (invalid.length > 0) throw new Error(`${invalid.length} lokasyonda koordinat eksik`);

  console.log(`Tamamlandı: ${activeRows.length} aktif lokasyon; ${rows.length} kayıt senkronlandı; 8 hedef dil, koordinat eksiği yok.`);
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});