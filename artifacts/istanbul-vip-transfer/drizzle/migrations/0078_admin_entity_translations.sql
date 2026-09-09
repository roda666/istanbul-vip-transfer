ALTER TABLE "faqs" ADD COLUMN IF NOT EXISTS "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "full_desc_translations" jsonb;