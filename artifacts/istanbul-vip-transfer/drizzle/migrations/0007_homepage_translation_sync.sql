-- Migration 0007: Homepage translation sync — adds source hash tracking and manual lock to content_translations
-- All changes are additive (IF NOT EXISTS / DEFAULT values) — safe for existing records.

ALTER TABLE "content_translations"
  ADD COLUMN IF NOT EXISTS "source_hash"       text,
  ADD COLUMN IF NOT EXISTS "is_manually_locked" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "locked_at"          timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "locked_by"          uuid REFERENCES "admin_users"("id") ON DELETE SET NULL;

-- Index for fast lookup of homepage translation rows that need re-sync
CREATE INDEX IF NOT EXISTS "ct_homepage_entity_type_idx"
  ON "content_translations" ("entity_type", "entity_id")
  WHERE "entity_type" = 'homepage';
