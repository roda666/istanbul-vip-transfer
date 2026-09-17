ALTER TABLE "content"
  ADD COLUMN IF NOT EXISTS "show_author" boolean NOT NULL DEFAULT true;