ALTER TABLE "route_toll_alternatives" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "route_toll_alternatives" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "banned_vehicle_types" jsonb;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "banned_vehicle_types_source_url" text;