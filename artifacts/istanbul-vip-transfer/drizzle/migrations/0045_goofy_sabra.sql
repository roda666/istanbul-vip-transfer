ALTER TABLE "transfer_routes" ADD COLUMN "distance_source" text DEFAULT 'LEGACY_UNVERIFIED' NOT NULL;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "distance_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "distance_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "default_vehicle_id" uuid;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_distance_verified_by_admin_users_id_fk" FOREIGN KEY ("distance_verified_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_default_vehicle_id_vehicles_id_fk" FOREIGN KEY ("default_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;