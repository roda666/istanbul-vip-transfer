ALTER TABLE "vehicles"
  ADD COLUMN IF NOT EXISTS "toll_class" text,
  ADD COLUMN IF NOT EXISTS "toll_class_source_url" text,
  ADD COLUMN IF NOT EXISTS "toll_class_evidence" text,
  ADD COLUMN IF NOT EXISTS "toll_class_verified_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "toll_class_verified_by" uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_toll_class_verified_by_admin_users_id_fk') THEN
    ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_toll_class_verified_by_admin_users_id_fk"
      FOREIGN KEY ("toll_class_verified_by") REFERENCES "admin_users"("id") ON DELETE SET NULL;
  END IF;
END $$;

UPDATE "vehicles" v
SET "toll_class" = CASE
  WHEN lower(v."name") LIKE '%volkswagen transporter%' THEN 'class_2'
  ELSE agreed."vehicle_class"
END
FROM (
  SELECT vehicle_id, min(vehicle_class) AS vehicle_class
  FROM vehicle_toll_point_classes
  GROUP BY vehicle_id
  HAVING count(DISTINCT vehicle_class) = 1
) agreed
WHERE v.id = agreed.vehicle_id
  AND v.toll_class IS NULL
  AND (lower(v.name) LIKE '%volkswagen transporter%' OR agreed.vehicle_class IN ('class_1','class_2','class_3','class_4','class_5','class_6'));

UPDATE "vehicles"
SET "toll_class" = 'class_2'
WHERE "toll_class" IS NULL AND lower("name") LIKE '%volkswagen transporter%';