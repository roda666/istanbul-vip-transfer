-- Strengthen the existing 0095 trigger without changing its initial data
-- deactivation. Historical inactive rows remain editable for audit/history.
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
    IF locked AND TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'No tariff (including inactive drafts) may be inserted for a locked toll point';
    END IF;
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