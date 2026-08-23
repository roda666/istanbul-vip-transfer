CREATE TABLE "flight_meet_greet_settings" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "provider_id" text DEFAULT 'NONE' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid,
  CONSTRAINT "flight_meet_greet_settings_provider_id_nonempty" CHECK (length(trim("provider_id")) > 0)
);
--> statement-breakpoint
ALTER TABLE "flight_meet_greet_settings" ADD CONSTRAINT "flight_meet_greet_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "flight_meet_greet_settings" ("id", "enabled", "provider_id")
VALUES (1, false, 'NONE')
ON CONFLICT ("id") DO NOTHING;