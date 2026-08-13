/**
 * One-time script: apply migration 0011_nine_language_registry
 * Sets es/fr/it/nl to isEnabled=true, isPublished=false.
 * Disables any language outside the 9-locale registry.
 *
 * Usage: pnpm --filter @workspace/istanbul-vip-transfer tsx scripts/run-migration-011.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const client = postgres(url, { max: 1 });

async function run() {
  console.log('Enabling es, fr, it, nl (isEnabled=true, isPublished=false)…');

  await client`
    INSERT INTO "languages" (
      "code", "locale", "name", "native_name", "turkish_name",
      "script", "direction", "provider_supported",
      "is_default", "is_enabled", "is_published", "display_order"
    )
    VALUES
      ('es', 'es-ES', 'Spanish',    'Español',    'İspanyolca',   'Latin', 'ltr', true, false, true, false, 6),
      ('fr', 'fr-FR', 'French',     'Français',   'Fransızca',    'Latin', 'ltr', true, false, true, false, 7),
      ('it', 'it-IT', 'Italian',    'Italiano',   'İtalyanca',    'Latin', 'ltr', true, false, true, false, 8),
      ('nl', 'nl-NL', 'Dutch',      'Nederlands', 'Hollandaca',   'Latin', 'ltr', true, false, true, false, 9)
    ON CONFLICT ("code") DO UPDATE SET
      "is_enabled"    = true,
      "display_order" = EXCLUDED."display_order",
      "updated_at"    = now()
  `;

  console.log('Disabling languages outside the 9-locale registry…');
  const result = await client`
    UPDATE "languages"
    SET "is_enabled" = false, "updated_at" = now()
    WHERE "code" NOT IN ('tr', 'en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl')
    RETURNING "code"
  `;
  if (result.length > 0) {
    console.log('Disabled:', result.map((r: { code: string }) => r.code).join(', '));
  } else {
    console.log('No extra languages to disable.');
  }

  const rows = await client`
    SELECT code, is_enabled, is_published, display_order
    FROM languages
    WHERE code IN ('tr','en','de','ru','ar','es','fr','it','nl')
    ORDER BY display_order
  `;
  console.log('\nFinal state of 9-locale registry:');
  for (const r of rows) {
    console.log(`  ${r.code}: enabled=${r.is_enabled} published=${r.is_published} order=${r.display_order}`);
  }

  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
