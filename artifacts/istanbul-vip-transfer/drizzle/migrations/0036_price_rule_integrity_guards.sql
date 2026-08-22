CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "route_price_rules"
  ADD CONSTRAINT "route_price_rules_supported_currency"
  CHECK ("currency" IN ('EUR', 'TRY', 'USD'));
--> statement-breakpoint
ALTER TABLE "route_price_rules"
  ADD CONSTRAINT "route_price_rules_no_active_window_overlap"
  EXCLUDE USING gist (
    "route_id" WITH =,
    "vehicle_id" WITH =,
    tstzrange("valid_from", "valid_until", '[]') WITH &&
  )
  WHERE ("active");