ALTER TABLE "toll_institution_api_settings"
  ADD COLUMN IF NOT EXISTS "organization_name_normalized" text;
--> statement-breakpoint
UPDATE "toll_institution_api_settings"
SET "organization_name_normalized" = lower(regexp_replace(btrim("organization_name"), '\s+', ' ', 'g'))
WHERE "organization_name_normalized" IS NULL;
--> statement-breakpoint
ALTER TABLE "toll_institution_api_settings"
  ALTER COLUMN "organization_name_normalized" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "toll_institution_api_org_service_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "toll_institution_api_org_service_unique"
  ON "toll_institution_api_settings" ("organization_name_normalized", "service_url");