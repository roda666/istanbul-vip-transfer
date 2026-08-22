ALTER TABLE "google_ads_connections" ADD COLUMN "connected" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "google_ads_connections" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "google_ads_connections" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "gsc_connections" ADD COLUMN "connected" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "gsc_connections" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "gsc_connections" ADD COLUMN "last_error" text;