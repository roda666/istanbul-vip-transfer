CREATE TYPE "public"."toll_time_band" AS ENUM('ALL', 'DAY', 'NIGHT');--> statement-breakpoint
CREATE TABLE "toll_pricing_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"stale_after_days" integer DEFAULT 180 NOT NULL,
	"day_start_hour" integer DEFAULT 6 NOT NULL,
	"night_start_hour" integer DEFAULT 22 NOT NULL,
	"warn_on_new_year_rollover" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "time_band" "toll_time_band" DEFAULT 'ALL' NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "applies_day" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "applies_night" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_pricing_settings" ADD CONSTRAINT "toll_pricing_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Day/night tariffs (migration 0062): the single ALL-vs-ALL exclusion constraint from
-- 0060 cannot express "ALL conflicts with both DAY and NIGHT, but DAY and NIGHT don't
-- conflict with each other". Replace it with two band-scoped partial exclusion
-- constraints driven by the applies_day/applies_night columns (ALL sets both true,
-- so an ALL row is still caught by both constraints against any DAY or NIGHT row).
ALTER TABLE "toll_tariffs" DROP CONSTRAINT IF EXISTS "toll_tariffs_active_window_no_overlap";--> statement-breakpoint
ALTER TABLE "toll_tariffs"
  ADD CONSTRAINT "toll_tariffs_active_window_no_overlap_day"
  EXCLUDE USING gist (
    "toll_point_id" WITH =,
    "vehicle_class" WITH =,
    tstzrange(
      COALESCE("valid_from", '-infinity'::timestamptz),
      COALESCE("valid_until", 'infinity'::timestamptz),
      '[]'
    ) WITH &&
  )
  WHERE ("active" AND "applies_day");--> statement-breakpoint
ALTER TABLE "toll_tariffs"
  ADD CONSTRAINT "toll_tariffs_active_window_no_overlap_night"
  EXCLUDE USING gist (
    "toll_point_id" WITH =,
    "vehicle_class" WITH =,
    tstzrange(
      COALESCE("valid_from", '-infinity'::timestamptz),
      COALESCE("valid_until", 'infinity'::timestamptz),
      '[]'
    ) WITH &&
  )
  WHERE ("active" AND "applies_night");