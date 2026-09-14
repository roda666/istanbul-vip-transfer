ALTER TABLE "toll_tariffs"
  ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY toll_point_id, vehicle_class
           ORDER BY display_order, id
         ) - 1 AS display_order
  FROM toll_tariffs
)
UPDATE toll_tariffs t
SET display_order = ranked.display_order
FROM ranked
WHERE t.id = ranked.id;

CREATE INDEX IF NOT EXISTS "toll_tariffs_order_idx"
  ON "toll_tariffs" ("toll_point_id", "vehicle_class", "display_order", "id");