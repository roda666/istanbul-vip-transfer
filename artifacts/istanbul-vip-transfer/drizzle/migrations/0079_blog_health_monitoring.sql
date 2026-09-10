-- Automated blog health history and restart-safe alert cooldowns.
CREATE TABLE IF NOT EXISTS "blog_health_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "unhealthy_count" integer DEFAULT 0 NOT NULL,
  "result" jsonb
);
CREATE TABLE IF NOT EXISTS "blog_health_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "last_alert_at" timestamp with time zone DEFAULT now() NOT NULL,
  "issues" jsonb NOT NULL,
  CONSTRAINT "blog_health_alerts_slug_unique" UNIQUE("slug")
);
CREATE INDEX IF NOT EXISTS "blog_health_runs_checked_at_idx" ON "blog_health_runs" ("checked_at");