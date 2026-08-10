-- Migration 0008: Language catalog expansion (backwards compatible)
-- Adds Turkish display name, script, provider support and publish state to languages.

ALTER TABLE "languages" ADD COLUMN IF NOT EXISTS "turkish_name" text;
ALTER TABLE "languages" ADD COLUMN IF NOT EXISTS "script" text DEFAULT 'Latn' NOT NULL;
ALTER TABLE "languages" ADD COLUMN IF NOT EXISTS "provider_supported" boolean DEFAULT true NOT NULL;
ALTER TABLE "languages" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT false NOT NULL;

-- Existing five languages remain publicly visible.
UPDATE "languages" SET "is_published" = true WHERE "code" IN ('tr', 'en', 'de', 'ru', 'ar');
