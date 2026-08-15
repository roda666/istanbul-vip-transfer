-- Migration 0016: AI İçerik Stüdyosu (Content Studio)
-- Full editorial workflow: Research → Draft → SEO → Visual → Translations → Approval → Schedule → Publish

-- ── studio_projects ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_projects" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "content_type"    text NOT NULL DEFAULT 'blog',
  "stage"           text NOT NULL DEFAULT 'setup',
  "status"          text NOT NULL DEFAULT 'draft',
  "title_working"   text,
  "config"          jsonb NOT NULL DEFAULT '{}',
  "tr_content"      jsonb,
  "cover_image_url" text,
  "cover_image_alt" text,
  "tr_approved_at"  timestamp with time zone,
  "tr_approved_by"  uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "seo_score"       jsonb,
  "cannibalization" jsonb,
  "cms_entity_id"   text,
  "cms_entity_type" text,
  "scheduled_for"   timestamp with time zone,
  "published_at"    timestamp with time zone,
  "created_by"      uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"      timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ── studio_project_translations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_project_translations" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id"   uuid NOT NULL REFERENCES "studio_projects"("id") ON DELETE CASCADE,
  "lang"         text NOT NULL,
  "content"      jsonb,
  "status"       text NOT NULL DEFAULT 'pending',
  "approved_at"  timestamp with time zone,
  "approved_by"  uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "published_at" timestamp with time zone,
  "ai_model"     text,
  "ai_tokens"    integer DEFAULT 0,
  "created_at"   timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"   timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("project_id", "lang")
);--> statement-breakpoint

-- ── studio_images ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_images" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id"       uuid NOT NULL REFERENCES "studio_projects"("id") ON DELETE CASCADE,
  "object_path"      text,
  "url"              text,
  "prompt"           text,
  "alt_text"         text,
  "usage_rights"     text NOT NULL DEFAULT 'ai_generated',
  "status"           text NOT NULL DEFAULT 'pending_approval',
  "rejection_reason" text,
  "approved_at"      timestamp with time zone,
  "approved_by"      uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at"       timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ── studio_research ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_research" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id"  uuid NOT NULL REFERENCES "studio_projects"("id") ON DELETE CASCADE,
  "url"         text,
  "title"       text,
  "accessed_at" timestamp with time zone DEFAULT now(),
  "claims"      jsonb NOT NULL DEFAULT '[]',
  "source_type" text NOT NULL DEFAULT 'ai_context',
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ── studio_distribution ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_distribution" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "studio_projects"("id") ON DELETE CASCADE,
  "platform"   text NOT NULL,
  "content"    text NOT NULL DEFAULT '',
  "status"     text NOT NULL DEFAULT 'draft',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("project_id", "platform")
);--> statement-breakpoint

-- ── studio_audit ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_audit" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "studio_projects"("id") ON DELETE CASCADE,
  "admin_id"   uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "action"     text NOT NULL,
  "detail"     jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ── studio_schedules ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "studio_schedules" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id"       uuid NOT NULL REFERENCES "studio_projects"("id") ON DELETE CASCADE,
  "scheduled_for"    timestamp with time zone NOT NULL,
  "langs"            text[] NOT NULL DEFAULT '{}',
  "idempotency_key"  text UNIQUE NOT NULL,
  "status"           text NOT NULL DEFAULT 'pending',
  "executed_at"      timestamp with time zone,
  "error"            text,
  "created_at"       timestamp with time zone DEFAULT now() NOT NULL
);
