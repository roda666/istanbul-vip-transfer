ALTER TABLE "google_reviews" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz;
ALTER TABLE "google_reviews" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;
DO $$ BEGIN
  ALTER TABLE "google_reviews" ADD CONSTRAINT "google_reviews_reviewed_by_admin_users_id_fk"
    FOREIGN KEY ("reviewed_by") REFERENCES "public"."admin_users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;