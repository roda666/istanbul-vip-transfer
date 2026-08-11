-- Migration: service health monitoring tables
-- Adds two tables for the automated service-page health check scheduler:
--   service_health_runs    — one row per scheduled check (audit trail + last-checked-at)
--   service_health_alerts  — one row per slug, tracking when the last alert email was sent

CREATE TABLE IF NOT EXISTS "service_health_runs" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "checked_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "unhealthy_count" integer DEFAULT 0 NOT NULL,
  "result"          jsonb
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_health_alerts" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug"          text NOT NULL,
  "last_alert_at" timestamp with time zone DEFAULT now() NOT NULL,
  "issues"        jsonb NOT NULL,
  CONSTRAINT "service_health_alerts_slug_unique" UNIQUE("slug")
);
