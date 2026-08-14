-- Migration 0014: Blog CMS additions
-- Adds IDEA + OUTDATED to content_status enum, blog_revisions table,
-- 7 blog-specific columns on content, and chatbot tables (new).
-- Does NOT re-create translation_jobs/tasks (0013) or email_settings (0010)
-- or content columns already added in 0012.

-- ── Enum additions ────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TYPE "public"."content_status" ADD VALUE 'IDEA' BEFORE 'DRAFT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TYPE "public"."content_status" ADD VALUE 'OUTDATED' BEFORE 'ARCHIVED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- ── New blog-specific columns on content ──────────────────────────────────────
ALTER TABLE "content" ADD COLUMN IF NOT EXISTS "author" text;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN IF NOT EXISTS "tags" jsonb;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN IF NOT EXISTS "read_time_minutes" integer;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN IF NOT EXISTS "internal_links" jsonb;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN IF NOT EXISTS "cta" jsonb;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN IF NOT EXISTS "og_title" text;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN IF NOT EXISTS "og_description" text;--> statement-breakpoint

-- ── blog_revisions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "blog_revisions" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "content_id"  uuid NOT NULL,
  "snapshot"    jsonb NOT NULL,
  "changed_by"  uuid,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "blog_revisions"
    ADD CONSTRAINT "blog_revisions_content_id_content_id_fk"
    FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "blog_revisions"
    ADD CONSTRAINT "blog_revisions_changed_by_admin_users_id_fk"
    FOREIGN KEY ("changed_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- ── Chatbot tables (new — no prior migration) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "chatbot_sessions" (
  "id"                   text PRIMARY KEY NOT NULL,
  "visitor_lang"         text DEFAULT 'tr' NOT NULL,
  "admin_active_until"   timestamp with time zone,
  "created_at"           timestamp with time zone DEFAULT now() NOT NULL,
  "last_message_at"      timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chatbot_messages" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" text NOT NULL,
  "role"       text NOT NULL,
  "content"    text NOT NULL,
  "content_tr" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chatbot_messages"
    ADD CONSTRAINT "chatbot_messages_session_id_chatbot_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."chatbot_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chatbot_settings" (
  "id"                 integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "ai_timeout_seconds" integer DEFAULT 60 NOT NULL,
  "updated_at"         timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ── email_settings updated_by FK (may not exist from 0010 raw SQL) ─────────────
DO $$ BEGIN
  ALTER TABLE "email_settings"
    ADD CONSTRAINT "email_settings_updated_by_admin_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
