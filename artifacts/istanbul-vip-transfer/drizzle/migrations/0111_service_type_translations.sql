ALTER TABLE "service_types"
  ADD COLUMN IF NOT EXISTS "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;