-- Preserve the former catalog-only rows for auditability, but remove them
-- from every public query. Complete records/translations are converged by the
-- idempotent db/seed-fleet.ts step included in db:migrate.
UPDATE vehicles
SET status = 'ARCHIVED', archived_at = now(), updated_at = now()
WHERE slug IN ('mercedes-e-class', 'mercedes-s-class', 'mercedes-v-class')
  AND status <> 'ARCHIVED';

-- Correct authoritative capacities immediately, including installations that
-- have not yet run the accompanying seed step.
UPDATE vehicles
SET passenger_capacity = 6, luggage_capacity = 5, vehicle_type = 'minivan',
    updated_at = now()
WHERE slug = 'mercedes-vito';

UPDATE vehicles
SET passenger_capacity = 7, luggage_capacity = 6, vehicle_type = 'minivan',
    updated_at = now()
WHERE slug = 'vw-transporter';

UPDATE vehicles
SET name = 'Mercedes Sprinter 13', passenger_capacity = 13,
    luggage_capacity = 13, vehicle_type = 'minibus', updated_at = now()
WHERE slug = 'mercedes-sprinter-vip';