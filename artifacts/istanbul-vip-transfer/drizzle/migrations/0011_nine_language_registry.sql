-- Migration: nine_language_registry
--
-- Activates es, fr, it, nl as supported languages (isEnabled=true).
-- isPublished remains false until their UI dictionaries ship
-- (task "Complete UI dictionaries for Spanish, French, Italian, Dutch").
--
-- Also disables any catalog entry outside the 9 supported locales.
-- Rows are NEVER deleted — admin state and history are preserved.

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
  "updated_at"    = now();

--> statement-breakpoint

-- Disable any language that is not one of the 9 supported locales.
-- Never deletes rows — only visibility is toggled.
UPDATE "languages"
SET "is_enabled" = false, "updated_at" = now()
WHERE "code" NOT IN ('tr', 'en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl');
