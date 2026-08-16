-- Migration 0020: Add per-language translation JSONB columns to transfer_routes.
-- These hold translated name / origin / destination for each locale.
-- Shape: {"en": "...", "de": "...", "ru": "...", "ar": "...", "fr": "...", "es": "...", "it": "...", "nl": "..."}
-- Fallback to the root (Turkish) column when a locale key is absent.

ALTER TABLE "transfer_routes"
  ADD COLUMN IF NOT EXISTS "name_translations"        jsonb,
  ADD COLUMN IF NOT EXISTS "origin_translations"      jsonb,
  ADD COLUMN IF NOT EXISTS "destination_translations" jsonb;
