ALTER TABLE "toll_points"
  ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY name, id) - 1 AS display_order
  FROM toll_points
)
UPDATE toll_points p
SET display_order = ranked.display_order
FROM ranked
WHERE p.id = ranked.id;