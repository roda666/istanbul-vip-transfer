-- Establish one deterministic default for every existing route that already
-- has active alternatives. The partial unique index from the previous
-- migration then preserves the invariant going forward.
UPDATE "route_toll_alternatives"
SET "is_default" = false;--> statement-breakpoint
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "route_id"
      ORDER BY "display_order" ASC, "created_at" ASC, "id" ASC
    ) AS rank
  FROM "route_toll_alternatives"
  WHERE "active" = true
)
UPDATE "route_toll_alternatives" AS alternatives
SET "is_default" = true
FROM ranked
WHERE alternatives."id" = ranked."id"
  AND ranked.rank = 1;