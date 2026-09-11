ALTER TABLE "drivers"
  ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY name, id) - 1 AS display_order
  FROM drivers
)
UPDATE drivers d
SET display_order = ranked.display_order
FROM ranked
WHERE d.id = ranked.id;

ALTER TABLE "drivers" ALTER COLUMN "display_order" DROP DEFAULT;