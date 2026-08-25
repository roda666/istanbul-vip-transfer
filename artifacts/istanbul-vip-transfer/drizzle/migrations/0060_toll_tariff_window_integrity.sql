CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "toll_tariffs"
  ADD CONSTRAINT "toll_tariffs_active_window_no_overlap"
  EXCLUDE USING gist (
    "toll_point_id" WITH =,
    "vehicle_class" WITH =,
    tstzrange(
      COALESCE("valid_from", '-infinity'::timestamptz),
      COALESCE("valid_until", 'infinity'::timestamptz),
      '[]'
    ) WITH &&
  )
  WHERE ("active");