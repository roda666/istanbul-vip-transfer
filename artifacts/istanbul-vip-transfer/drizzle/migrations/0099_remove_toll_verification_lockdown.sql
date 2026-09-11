-- Owner-approved removal of the toll verification write lockdown.
-- Deliberately does not alter active state, tariffs, prices, or alternatives.
DROP TRIGGER IF EXISTS toll_points_verification_lock_guard ON toll_points;
DROP TRIGGER IF EXISTS toll_points_verification_lock_delete_guard ON toll_points;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'toll_tariffs','vehicle_toll_point_classes',
    'route_toll_alternative_items','intercity_toll_corridor_alternative_items',
    'route_toll_alternatives','intercity_toll_corridor_alternatives'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS locked_toll_point_guard ON %I', t);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS reject_locked_toll_point_use();
DROP FUNCTION IF EXISTS reject_locked_toll_point_delete();

UPDATE toll_points
SET verification_locked = false,
    verification_lock_reason = NULL,
    verification_locked_at = NULL,
    verification_locked_by = NULL,
    updated_at = now()
WHERE id IN (
  '23fa5f1d-b43f-43ab-9984-c2684cf8055d'::uuid,
  '1058e3a6-07a8-4844-bc1a-6e9d31314597'::uuid,
  '402dfb8e-176f-4b18-8cfe-020557765768'::uuid
);