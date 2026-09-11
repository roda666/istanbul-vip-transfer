-- Fresh-install reconciliation: older histories may omit the route default
-- vehicle column even though the current schema requires it.  Do not alter
-- existing values; only add the missing structure.
ALTER TABLE "transfer_routes"
  ADD COLUMN IF NOT EXISTS "default_vehicle_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transfer_routes_default_vehicle_id_vehicles_id_fk'
      AND conrelid = 'transfer_routes'::regclass
  ) THEN
    ALTER TABLE "transfer_routes"
      ADD CONSTRAINT "transfer_routes_default_vehicle_id_vehicles_id_fk"
      FOREIGN KEY ("default_vehicle_id") REFERENCES "vehicles"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;