-- Migration 0015: AI Content Hub
-- Adds topic_clusters table, extends ai_content_suggestions with hub fields,
-- and adds optional content_id + claim columns to research_sources.

-- ── topic_clusters ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "topic_clusters" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pillar_slug"      text NOT NULL,
  "pillar_title"     text NOT NULL,
  "cluster_articles" jsonb NOT NULL DEFAULT '[]',
  "suggested_links"  jsonb NOT NULL DEFAULT '[]',
  "created_by"       uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at"       timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"       timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ── ai_content_suggestions — new columns ──────────────────────────────────────
ALTER TABLE "ai_content_suggestions"
  ADD COLUMN IF NOT EXISTS "suggested_keywords_json"  jsonb,
  ADD COLUMN IF NOT EXISTS "ai_summary"               text,
  ADD COLUMN IF NOT EXISTS "content_draft"            text,
  ADD COLUMN IF NOT EXISTS "draft_error"              text,
  ADD COLUMN IF NOT EXISTS "customer_profile"         text,
  ADD COLUMN IF NOT EXISTS "target_country"           text,
  ADD COLUMN IF NOT EXISTS "target_language"          text NOT NULL DEFAULT 'tr',
  ADD COLUMN IF NOT EXISTS "content_brief"            jsonb,
  ADD COLUMN IF NOT EXISTS "quality_score"            jsonb,
  ADD COLUMN IF NOT EXISTS "cannibalization_warning"  jsonb,
  ADD COLUMN IF NOT EXISTS "topic_cluster_id"         uuid REFERENCES "topic_clusters"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "draft_blog_post_id"       uuid REFERENCES "content"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "time_sensitive"           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_reviewed_at"         timestamp with time zone;--> statement-breakpoint

-- ── research_sources — new columns ────────────────────────────────────────────
ALTER TABLE "research_sources"
  ADD COLUMN IF NOT EXISTS "content_id"        uuid REFERENCES "content"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "claim_supported"   text,
  ADD COLUMN IF NOT EXISTS "source_type"       text NOT NULL DEFAULT 'manual';--> statement-breakpoint

-- suggestionId was previously NOT NULL; make nullable for content-only sources
DO $$ BEGIN
  ALTER TABLE "research_sources" ALTER COLUMN "suggestion_id" DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
