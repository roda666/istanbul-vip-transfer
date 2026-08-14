-- Migration 0013: Add translation_jobs and translation_job_tasks tables
-- These tables back the persistent, browser-survive-able bulk AI translation queue.

CREATE TABLE IF NOT EXISTS "translation_jobs" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type"     TEXT NOT NULL,
  "entity_id"       UUID NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'QUEUED',
  "force"           BOOLEAN NOT NULL DEFAULT FALSE,
  "total_tasks"     INTEGER NOT NULL DEFAULT 0,
  "completed_tasks" INTEGER NOT NULL DEFAULT 0,
  "failed_tasks"    INTEGER NOT NULL DEFAULT 0,
  "created_by"      UUID REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at"      TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at"      TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "completed_at"    TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS "translation_job_tasks" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id"               UUID NOT NULL REFERENCES "translation_jobs"("id") ON DELETE CASCADE,
  "target_language_code" TEXT NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts"             INTEGER NOT NULL DEFAULT 0,
  "error_message"        TEXT,
  "translation_id"       UUID,
  "started_at"           TIMESTAMP WITH TIME ZONE,
  "completed_at"         TIMESTAMP WITH TIME ZONE,
  "created_at"           TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at"           TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE("job_id", "target_language_code")
);

CREATE INDEX IF NOT EXISTS "idx_translation_jobs_entity"
  ON "translation_jobs" ("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "idx_translation_job_tasks_job"
  ON "translation_job_tasks" ("job_id");

CREATE INDEX IF NOT EXISTS "idx_translation_job_tasks_status"
  ON "translation_job_tasks" ("job_id", "status");
