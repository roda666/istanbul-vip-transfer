ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE "vehicles"
SET
  "status" = 'PUBLISHED',
  "archived_at" = NULL,
  "is_active" = true,
  "price_calculation_eligible" = false,
  "pricing_class" = 'minivan',
  "short_description" = CASE "slug"
    WHEN 'mercedes-e-class' THEN 'Mercedes E-Class, özel transferler için talep üzerine sunulan sedan seçeneği.'
    WHEN 'mercedes-s-class' THEN 'Mercedes S-Class, özel transferler için talep üzerine sunulan sedan seçeneği.'
    WHEN 'mercedes-v-class' THEN 'Mercedes V-Class, özel transferler için talep üzerine sunulan araç seçeneği.'
  END,
  "features" = '[]'::jsonb,
  "updated_at" = now()
WHERE "slug" IN ('mercedes-e-class', 'mercedes-s-class', 'mercedes-v-class');
--> statement-breakpoint
UPDATE "vehicles"
SET
  "passenger_capacity" = CASE "slug"
    WHEN 'mercedes-vito' THEN 6
    WHEN 'vw-transporter' THEN 7
    WHEN 'mercedes-sprinter-10' THEN 10
    WHEN 'mercedes-sprinter-vip' THEN 13
    WHEN 'mercedes-sprinter-15' THEN 15
    WHEN 'mercedes-sprinter-19' THEN 19
    WHEN 'midibus-25' THEN 25
    WHEN 'coach-45' THEN 45
  END,
  "luggage_capacity" = CASE "slug"
    WHEN 'mercedes-vito' THEN 5
    WHEN 'vw-transporter' THEN 6
    WHEN 'mercedes-sprinter-10' THEN 10
    WHEN 'mercedes-sprinter-vip' THEN 13
    WHEN 'mercedes-sprinter-15' THEN 15
    WHEN 'mercedes-sprinter-19' THEN 19
    WHEN 'midibus-25' THEN 25
    WHEN 'coach-45' THEN 45
  END,
  "vehicle_type" = CASE
    WHEN "slug" IN ('mercedes-vito', 'vw-transporter') THEN 'minivan'
    WHEN "slug" LIKE 'mercedes-sprinter-%' THEN 'minibus'
    WHEN "slug" = 'midibus-25' THEN 'midibus'
    WHEN "slug" = 'coach-45' THEN 'bus'
  END,
  "price_calculation_eligible" = true,
  "pricing_class" = CASE
    WHEN "slug" IN ('mercedes-vito', 'vw-transporter') THEN 'minivan'
    WHEN "slug" LIKE 'mercedes-sprinter-%' THEN 'minibus'
    WHEN "slug" = 'midibus-25' THEN 'midibus'
    WHEN "slug" = 'coach-45' THEN 'bus'
  END,
  "updated_at" = now()
WHERE "slug" IN (
  'mercedes-vito', 'vw-transporter', 'mercedes-sprinter-10',
  'mercedes-sprinter-vip', 'mercedes-sprinter-15', 'mercedes-sprinter-19',
  'midibus-25', 'coach-45'
);
--> statement-breakpoint
ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_request_only_not_price_eligible"
  CHECK (
    "slug" NOT IN ('mercedes-e-class', 'mercedes-s-class', 'mercedes-v-class')
    OR "price_calculation_eligible" = false
  );