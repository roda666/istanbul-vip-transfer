-- Irreversible safety lockdown for the three explicitly authorized development
-- database toll points.  This migration is intentionally not idempotent with
-- respect to the lock itself: a locked point can only be unlocked by a future,
-- separately reviewed official-verification migration.
ALTER TABLE "toll_points"
  ADD COLUMN IF NOT EXISTS "verification_locked" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verification_lock_reason" text,
  ADD COLUMN IF NOT EXISTS "verification_locked_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "verification_locked_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE "toll_points" ADD CONSTRAINT "toll_points_lock_reason_length"
    CHECK ("verification_lock_reason" IS NULL OR length("verification_lock_reason") BETWEEN 1 AND 1000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION reject_locked_toll_point_use() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE locked boolean;
BEGIN
  IF TG_TABLE_NAME = 'toll_points' THEN
    IF OLD.verification_locked AND (NEW.active OR NOT NEW.verification_locked) THEN
      RAISE EXCEPTION 'Locked toll point cannot be reactivated or unlocked';
    END IF;
    IF NEW.verification_locked AND NEW.verification_lock_reason IS NULL THEN
      RAISE EXCEPTION 'Locked toll point requires a bounded reason';
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'toll_tariffs' THEN
    SELECT verification_locked INTO locked FROM toll_points WHERE id = NEW.toll_point_id;
    IF locked AND NEW.active THEN RAISE EXCEPTION 'Active tariff is forbidden for a locked toll point'; END IF;
  ELSIF TG_TABLE_NAME = 'vehicle_toll_point_classes' THEN
    SELECT verification_locked INTO locked FROM toll_points WHERE id = NEW.toll_point_id;
    IF locked THEN RAISE EXCEPTION 'Vehicle assignment is forbidden for a locked toll point'; END IF;
  ELSIF TG_TABLE_NAME IN ('route_toll_alternative_items','intercity_toll_corridor_alternative_items') THEN
    SELECT verification_locked INTO locked FROM toll_points WHERE id = NEW.toll_point_id;
    IF locked THEN RAISE EXCEPTION 'Locked toll point cannot be added to an alternative'; END IF;
  ELSIF TG_TABLE_NAME IN ('route_toll_alternatives','intercity_toll_corridor_alternatives') THEN
    IF NEW.active AND EXISTS (
      SELECT 1 FROM toll_points p
      JOIN (SELECT toll_point_id FROM route_toll_alternative_items WHERE alternative_id = NEW.id
            UNION ALL SELECT toll_point_id FROM intercity_toll_corridor_alternative_items WHERE alternative_id = NEW.id) i
        ON i.toll_point_id = p.id
      WHERE p.verification_locked
    ) THEN RAISE EXCEPTION 'Alternative containing a locked toll point cannot be active'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION reject_locked_toll_point_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'toll_points' AND OLD.verification_locked THEN
    RAISE EXCEPTION 'Locked toll point cannot be deleted';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS toll_points_verification_lock_guard ON toll_points;
CREATE TRIGGER toll_points_verification_lock_guard BEFORE UPDATE ON toll_points
FOR EACH ROW EXECUTE FUNCTION reject_locked_toll_point_use();
DROP TRIGGER IF EXISTS toll_points_verification_lock_delete_guard ON toll_points;
CREATE TRIGGER toll_points_verification_lock_delete_guard BEFORE DELETE ON toll_points
FOR EACH ROW EXECUTE FUNCTION reject_locked_toll_point_delete();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['toll_tariffs','vehicle_toll_point_classes',
    'route_toll_alternative_items','intercity_toll_corridor_alternative_items',
    'route_toll_alternatives','intercity_toll_corridor_alternatives'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS locked_toll_point_guard ON %I', t);
    EXECUTE format('CREATE TRIGGER locked_toll_point_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION reject_locked_toll_point_use()', t);
  END LOOP;
END $$;

-- Lock only the exact authorized IDs. Bursa and Sapanca are deliberately not
-- referenced by this migration.
WITH targets(id, reason) AS (
  VALUES
    ('23fa5f1d-b43f-43ab-9984-c2684cf8055d'::uuid, 'Urgent safety lockdown: Ankara requires official source verification before any use.'),
    ('1058e3a6-07a8-4844-bc1a-6e9d31314597'::uuid, 'Urgent safety lockdown: Antalya requires official source verification before any use.'),
    ('402dfb8e-176f-4b18-8cfe-020557765768'::uuid, 'Urgent safety lockdown: Bodrum requires official source verification before any use.')
)
UPDATE toll_points p SET active = false, verification_locked = true,
  verification_lock_reason = t.reason, verification_locked_at = now(), updated_at = now()
FROM targets t WHERE p.id = t.id;

UPDATE toll_tariffs t SET active = false, updated_at = now()
WHERE t.toll_point_id IN (
  '23fa5f1d-b43f-43ab-9984-c2684cf8055d'::uuid,
  '1058e3a6-07a8-4844-bc1a-6e9d31314597'::uuid,
  '402dfb8e-176f-4b18-8cfe-020557765768'::uuid
);

UPDATE route_toll_alternatives a SET active = false, is_default = false, updated_at = now()
WHERE EXISTS (SELECT 1 FROM route_toll_alternative_items i WHERE i.alternative_id = a.id
  AND i.toll_point_id IN ('23fa5f1d-b43f-43ab-9984-c2684cf8055d'::uuid,'1058e3a6-07a8-4844-bc1a-6e9d31314597'::uuid,'402dfb8e-176f-4b18-8cfe-020557765768'::uuid));
UPDATE intercity_toll_corridor_alternatives a SET active = false, is_default = false, updated_at = now()
WHERE EXISTS (SELECT 1 FROM intercity_toll_corridor_alternative_items i WHERE i.alternative_id = a.id
  AND i.toll_point_id IN ('23fa5f1d-b43f-43ab-9984-c2684cf8055d'::uuid,'1058e3a6-07a8-4844-bc1a-6e9d31314597'::uuid,'402dfb8e-176f-4b18-8cfe-020557765768'::uuid));