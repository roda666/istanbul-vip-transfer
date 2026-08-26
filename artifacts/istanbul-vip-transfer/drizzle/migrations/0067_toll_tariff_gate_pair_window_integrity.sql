-- The day/night exclusion constraints added in 0060/0062 only key on
-- (toll_point_id, vehicle_class, active window). That is correct for FLAT
-- points (at most one active tariff per point+class+timeband), but a
-- GATE_PAIR point legitimately needs MANY simultaneously-active rows per
-- (toll_point_id, vehicle_class) — one per distinct entry/exit gate pair.
-- Without entry_gate_name/exit_gate_name in the exclusion key, inserting a
-- second gate pair's tariff for the same point+class was rejected as a
-- false "overlap".
--
-- Fix: fold COALESCE(entry_gate_name, '') / COALESCE(exit_gate_name, '')
-- into the exclusion key (same COALESCE-to-sentinel technique already used
-- for valid_from/valid_until). FLAT points always have NULL/NULL gate names,
-- which coalesce to the same ('','') sentinel pair for every FLAT row at a
-- given point+class — so FLAT points keep exactly the same one-active-row
-- guarantee as before. GATE_PAIR points get a distinct sentinel per gate
-- pair, so distinct pairs no longer collide with each other, while two rows
-- for the SAME gate pair still correctly conflict.
ALTER TABLE "toll_tariffs" DROP CONSTRAINT IF EXISTS "toll_tariffs_active_window_no_overlap_day";--> statement-breakpoint
ALTER TABLE "toll_tariffs" DROP CONSTRAINT IF EXISTS "toll_tariffs_active_window_no_overlap_night";--> statement-breakpoint
ALTER TABLE "toll_tariffs"
  ADD CONSTRAINT "toll_tariffs_active_window_no_overlap_day"
  EXCLUDE USING gist (
    "toll_point_id" WITH =,
    "vehicle_class" WITH =,
    COALESCE("entry_gate_name", '') WITH =,
    COALESCE("exit_gate_name", '') WITH =,
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
    COALESCE("entry_gate_name", '') WITH =,
    COALESCE("exit_gate_name", '') WITH =,
    tstzrange(
      COALESCE("valid_from", '-infinity'::timestamptz),
      COALESCE("valid_until", 'infinity'::timestamptz),
      '[]'
    ) WITH &&
  )
  WHERE ("active" AND "applies_night");--> statement-breakpoint
