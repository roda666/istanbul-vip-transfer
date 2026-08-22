-- Locale route pages must never be published from a Turkish legacy card label.
-- Records without a full existing locale card translation remain editable drafts.
UPDATE "transfer_route_translations" AS tx
SET "status" = 'DRAFT',
    "published_at" = NULL,
    "updated_at" = now()
FROM "transfer_routes" AS route
WHERE tx."route_id" = route."id"
  AND tx."status" = 'PUBLISHED'
  AND (
    COALESCE(route."name_translations" ->> tx."language_code", '') = ''
    OR COALESCE(route."origin_translations" ->> tx."language_code", '') = ''
    OR COALESCE(route."destination_translations" ->> tx."language_code", '') = ''
  );