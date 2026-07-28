CREATE TYPE "public"."location_type" AS ENUM('AIRPORT', 'DISTRICT', 'REGION', 'HOTEL_ZONE', 'CUSTOM');--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"city" text DEFAULT 'İstanbul' NOT NULL,
	"district" text,
	"type" "location_type" DEFAULT 'DISTRICT' NOT NULL,
	"pickup_enabled" boolean DEFAULT true NOT NULL,
	"dropoff_enabled" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "time_step_minutes" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "exact_address_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "location_search_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
