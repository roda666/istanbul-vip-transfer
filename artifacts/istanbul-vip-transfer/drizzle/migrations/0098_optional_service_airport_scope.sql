-- Repair only the two known active optional services whose scope was empty.
-- No financial or other catalog fields are changed.
UPDATE optional_services
SET service_type_scope = '["AIRPORT_TRANSFER"]'::jsonb
WHERE active = true
  AND archived_at IS NULL
  AND key IN ('KARILAMA', 'CHILD_SEAT')
  AND service_type_scope = '[]'::jsonb;