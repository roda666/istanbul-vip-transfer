-- Migration 0019: Add unique slug column to transfer_routes.
-- Data-preserving: no rows are deleted.
-- Generates clean, human-readable slugs from image_path, with a numeric suffix
-- (-2, -3 …) only when two rows share the same base slug.
-- This produces the same slug values the seed script uses (e.g. taksim-sabiha),
-- so consecutive db:migrate + seed runs remain fully idempotent.

-- 1. Add slug column (nullable initially so we can backfill)
ALTER TABLE "transfer_routes"
  ADD COLUMN IF NOT EXISTS "slug" text;

-- 2. Backfill: derive a base slug from image_path (or 'route' as fallback).
--    For duplicate base slugs, append -2, -3 … ordered by created_at.
UPDATE "transfer_routes" r
SET slug = sub.final_slug
FROM (
  SELECT
    id,
    base_slug
      || CASE
           WHEN ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY created_at, id) = 1
           THEN ''
           ELSE '-' || (ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY created_at, id))::text
         END AS final_slug
  FROM (
    SELECT
      id,
      created_at,
      COALESCE(
        NULLIF(
          regexp_replace(
            regexp_replace(image_path, '^/route-images/', ''),
            '\.jpe?g$', ''
          ),
          ''
        ),
        'route'
      ) AS base_slug
    FROM "transfer_routes"
  ) t
) sub
WHERE r.id = sub.id
  AND r.slug IS NULL;

-- 3. Enforce NOT NULL
ALTER TABLE "transfer_routes"
  ALTER COLUMN "slug" SET NOT NULL;

-- 4. Add unique constraint
ALTER TABLE "transfer_routes"
  ADD CONSTRAINT "transfer_routes_slug_unique" UNIQUE ("slug");
