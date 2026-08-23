ALTER TABLE "research_sources"
  ADD COLUMN IF NOT EXISTS "provenance_status" text DEFAULT 'UNVERIFIED_LEGACY' NOT NULL;