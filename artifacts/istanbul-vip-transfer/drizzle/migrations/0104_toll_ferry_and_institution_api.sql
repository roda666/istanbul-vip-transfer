ALTER TYPE "public"."toll_point_type" ADD VALUE IF NOT EXISTS 'FERRY';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "toll_institution_api_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"organization_name" text NOT NULL,
	"service_url" text NOT NULL,
	"api_code_ciphertext" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "toll_institution_api_settings"
    ADD CONSTRAINT "toll_institution_api_settings_updated_by_admin_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;