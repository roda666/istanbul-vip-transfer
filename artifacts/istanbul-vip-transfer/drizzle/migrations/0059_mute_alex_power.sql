-- Normalize legacy records before adding the index. This handles routes with
-- no default, several defaults, or a stale default on an inactive alternative.
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
  AND ranked.rank = 1;--> statement-breakpoint
CREATE UNIQUE INDEX "route_toll_alternative_one_default_unique" ON "route_toll_alternatives" USING btree ("route_id") WHERE "route_toll_alternatives"."is_default" = true;