-- Google Business Profile OAuth connection metadata and real review source identity.
-- OAuth access and refresh tokens remain encrypted in social_platforms.
ALTER TABLE "social_platforms"
  ADD COLUMN IF NOT EXISTS "token_expires_at" timestamp with time zone;

ALTER TABLE "studio_distribution"
  ADD COLUMN IF NOT EXISTS "remote_id" text,
  ADD COLUMN IF NOT EXISTS "remote_url" text,
  ADD COLUMN IF NOT EXISTS "last_error" text,
  ADD COLUMN IF NOT EXISTS "retry_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;

ALTER TABLE "google_reviews"
  ADD COLUMN IF NOT EXISTS "external_review_id" text,
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "location_resource_name" text;

CREATE UNIQUE INDEX IF NOT EXISTS "google_reviews_external_review_id_idx"
  ON "google_reviews" ("external_review_id");

CREATE INDEX IF NOT EXISTS "google_reviews_google_business_visible_idx"
  ON "google_reviews" ("source", "is_visible", "sort_order");