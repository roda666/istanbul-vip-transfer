CREATE SEQUENCE IF NOT EXISTS "toll_institution_api_settings_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "toll_institution_api_settings_id_seq" OWNED BY "toll_institution_api_settings"."id";
--> statement-breakpoint
ALTER TABLE "toll_institution_api_settings"
  ALTER COLUMN "id" SET DEFAULT nextval('"toll_institution_api_settings_id_seq"');
--> statement-breakpoint
SELECT setval(
  '"toll_institution_api_settings_id_seq"',
  GREATEST(COALESCE((SELECT MAX("id") FROM "toll_institution_api_settings"), 0), 1),
  COALESCE((SELECT MAX("id") FROM "toll_institution_api_settings"), 0) > 0
);
--> statement-breakpoint
ALTER TABLE "toll_institution_api_settings"
  ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "toll_institution_api_settings"
    ADD CONSTRAINT "toll_institution_api_settings_created_by_admin_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "toll_institution_api_org_service_unique"
  ON "toll_institution_api_settings" ("organization_name", "service_url");