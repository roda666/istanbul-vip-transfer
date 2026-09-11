ALTER TABLE "optional_services"
  ADD COLUMN IF NOT EXISTS "short_description" text,
  ADD COLUMN IF NOT EXISTS "name_translations" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "short_description_translations" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "service_type_scope" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "customer_visible" boolean NOT NULL DEFAULT true;

-- Normalize legacy meet-and-greet spellings without creating a unique-key
-- collision when the canonical row already exists.
UPDATE "optional_services" legacy
SET "key" = 'flight-meet-greet'
WHERE lower(replace(replace("key", '_', '-'), ' ', '-')) IN ('flight-meet-greet', 'flight-meet-and-greet')
  AND "key" <> 'flight-meet-greet'
  AND NOT EXISTS (
    SELECT 1 FROM "optional_services" canonical
    WHERE canonical."key" = 'flight-meet-greet'
  )
  AND (
    SELECT count(*) FROM "optional_services" semantic
    WHERE lower(replace(replace(semantic."key", '_', '-'), ' ', '-'))
      IN ('flight-meet-greet', 'flight-meet-and-greet')
  ) = 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'optional_services_currency_check') THEN
    ALTER TABLE "optional_services" ADD CONSTRAINT "optional_services_currency_check" CHECK ("currency" IN ('TRY', 'EUR', 'USD')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'optional_services_amount_check') THEN
    ALTER TABLE "optional_services" ADD CONSTRAINT "optional_services_amount_check" CHECK ("unit_amount" > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'optional_services_quantity_check') THEN
    ALTER TABLE "optional_services" ADD CONSTRAINT "optional_services_quantity_check" CHECK ("maximum_quantity" >= 1) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'optional_services_charge_type_check') THEN
    ALTER TABLE "optional_services" ADD CONSTRAINT "optional_services_charge_type_check" CHECK ("charge_type" IN ('PER_BOOKING', 'PER_PERSON')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'optional_services_per_booking_quantity_check') THEN
    ALTER TABLE "optional_services" ADD CONSTRAINT "optional_services_per_booking_quantity_check"
      CHECK ("charge_type" <> 'PER_BOOKING' OR "maximum_quantity" = 1) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'optional_services_meet_greet_key_check') THEN
    -- Preserve legacy aliases, but prevent any new duplicate semantic key.
    ALTER TABLE "optional_services" ADD CONSTRAINT "optional_services_meet_greet_key_check"
      CHECK (lower(replace(replace("key", '_', '-'), ' ', '-')) NOT IN ('flight-meet-and-greet', 'flight-meet-greet')
             OR "key" = 'flight-meet-greet') NOT VALID;
  END IF;
END $$;

ALTER TABLE "content_translations"
  ADD COLUMN IF NOT EXISTS "service_name" text,
  ADD COLUMN IF NOT EXISTS "service_short_description" text;

ALTER TABLE "reservation_requests"
  ADD COLUMN IF NOT EXISTS "optional_services_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb;