ALTER TABLE "translation_jobs"
  ADD COLUMN IF NOT EXISTS "source_hash" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "translation_jobs_entity_source_idx"
  ON "translation_jobs" ("entity_type", "entity_id", "source_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "translation_jobs_active_entity_source_unique"
  ON "translation_jobs" ("entity_type", "entity_id", "source_hash")
  WHERE "source_hash" IS NOT NULL
    AND "status" IN ('QUEUED', 'RUNNING', 'PARTIAL');