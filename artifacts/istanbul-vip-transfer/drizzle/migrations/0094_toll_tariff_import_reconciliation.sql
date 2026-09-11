DROP INDEX IF EXISTS "toll_tariff_imports_preview_hash_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "toll_tariff_imports_preview_identity_unique"
  ON "toll_tariff_imports" ("preview_hash", "toll_point_id", "created_by");
DO $$ BEGIN
  ALTER TABLE "toll_tariff_imports" ADD CONSTRAINT "toll_tariff_imports_status_check"
    CHECK ("status" IN ('PREVIEW', 'CONFIRMING', 'CONFIRMED', 'FAILED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "toll_tariff_imports" ADD CONSTRAINT "toll_tariff_imports_parser_version_check"
    CHECK ("parser_version" ~ '^[0-9]+\.[0-9]+\.[0-9]+$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "toll_tariff_imports" ADD CONSTRAINT "toll_tariff_imports_preview_hash_check"
    CHECK ("preview_hash" ~ '^[0-9a-f]{64}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "toll_pricing_settings" ALTER COLUMN "warn_on_new_year_rollover" SET DEFAULT false;