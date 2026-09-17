ALTER TABLE "translation_jobs"
  ADD COLUMN IF NOT EXISTS "source_snapshot" jsonb;