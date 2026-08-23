ALTER TABLE "locations" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "coordinate_source" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "coordinate_accuracy_meters" integer;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "road_distance_multiplier" double precision DEFAULT 1.25 NOT NULL;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "origin_location_id" uuid;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "destination_location_id" uuid;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_origin_location_id_locations_id_fk" FOREIGN KEY ("origin_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_destination_location_id_locations_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;