ALTER TABLE "service_health_alerts" ALTER COLUMN "last_alert_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "service_health_alerts" ALTER COLUMN "last_alert_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_health_alerts" ADD COLUMN "first_seen_at" timestamp with time zone;--> statement-breakpoint
UPDATE "service_health_alerts"
SET "first_seen_at" = "last_alert_at"
WHERE "first_seen_at" IS NULL;