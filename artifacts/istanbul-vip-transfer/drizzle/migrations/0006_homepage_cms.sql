-- Migration 0006: Homepage CMS — google_reviews table
-- Homepage content is stored in the existing `content` and `content_translations` tables.
-- Only a new standalone table is needed for genuine Google reviews.

CREATE TABLE IF NOT EXISTS "google_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reviewer_name" text NOT NULL,
  "review_text" text NOT NULL,
  "rating" integer NOT NULL DEFAULT 5,
  "review_language" text NOT NULL DEFAULT 'tr',
  "review_date" timestamp with time zone,
  "is_visible" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "google_source_indicator" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
