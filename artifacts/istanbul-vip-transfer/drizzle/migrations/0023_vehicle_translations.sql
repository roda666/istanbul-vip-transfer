-- Migration 0023: Add i18n JSONB columns to vehicles table
-- {"en":"…","de":"…","ru":"…","ar":"…","fr":"…","es":"…","it":"…","nl":"…","tr":"…"}
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS name_translations jsonb,
  ADD COLUMN IF NOT EXISTS short_desc_translations jsonb,
  ADD COLUMN IF NOT EXISTS tagline_translations jsonb;
