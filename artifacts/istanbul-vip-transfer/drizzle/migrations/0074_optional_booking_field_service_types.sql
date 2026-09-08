ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "optional_field_service_types" jsonb NOT NULL DEFAULT '{}'::jsonb;