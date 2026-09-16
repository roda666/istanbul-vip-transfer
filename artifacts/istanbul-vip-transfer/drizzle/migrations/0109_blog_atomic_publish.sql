ALTER TABLE "translation_jobs"
ADD COLUMN IF NOT EXISTS "publish_on_complete" boolean DEFAULT false NOT NULL;

ALTER TABLE "translation_job_tasks"
ADD COLUMN IF NOT EXISTS "result_payload" jsonb;