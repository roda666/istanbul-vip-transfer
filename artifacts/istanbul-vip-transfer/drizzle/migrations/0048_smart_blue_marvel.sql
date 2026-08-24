ALTER TABLE "transfer_route_translations" ADD COLUMN "intro_paragraph" text;--> statement-breakpoint
ALTER TABLE "transfer_route_translations" ADD COLUMN "transport_options" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "transfer_route_translations" ADD COLUMN "route_notes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "transfer_route_translations" ADD COLUMN "faq_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "normal_duration_min_minutes" integer;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "normal_duration_max_minutes" integer;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "peak_duration_min_minutes" integer;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "peak_duration_max_minutes" integer;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "has_cross_continent_passage" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "intro_paragraph" text;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "transport_options" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "route_notes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "faq_items" jsonb DEFAULT '[]'::jsonb NOT NULL;