ALTER TABLE "optional_services" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "optional_services_active_archive_idx"
  ON "optional_services" USING btree ("active", "archived_at");