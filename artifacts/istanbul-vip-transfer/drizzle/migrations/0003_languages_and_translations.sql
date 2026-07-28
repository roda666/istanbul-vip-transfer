-- Migration 0003: Add multilingual support (languages + content_translations)

-- 1. Add text_direction enum
DO $$ BEGIN
  CREATE TYPE "public"."text_direction" AS ENUM('ltr', 'rtl');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add translation_status enum
DO $$ BEGIN
  CREATE TYPE "public"."translation_status" AS ENUM(
    'NOT_STARTED', 'QUEUED', 'TRANSLATING', 'DRAFT', 'REVIEW',
    'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'OUTDATED', 'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create languages table
CREATE TABLE IF NOT EXISTS "languages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "locale" text NOT NULL,
  "name" text NOT NULL,
  "native_name" text NOT NULL,
  "direction" "text_direction" DEFAULT 'ltr' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  CONSTRAINT "languages_code_unique" UNIQUE("code")
);

-- 4. Create content_translations table
CREATE TABLE IF NOT EXISTS "content_translations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "source_language_code" text DEFAULT 'tr' NOT NULL,
  "target_language_code" text NOT NULL,
  "status" "translation_status" DEFAULT 'NOT_STARTED' NOT NULL,
  "title" text,
  "slug" text,
  "excerpt" text,
  "body" text,
  "meta_title" text,
  "meta_description" text,
  "focus_keyword" text,
  "supporting_keywords" jsonb,
  "image_alt" text,
  "image_title" text,
  "image_caption" text,
  "is_ai_generated" boolean DEFAULT false NOT NULL,
  "ai_model" text,
  "ai_prompt_version" text,
  "queued_at" timestamptz,
  "translating_at" timestamptz,
  "draft_at" timestamptz,
  "review_at" timestamptz,
  "approved_at" timestamptz,
  "scheduled_at" timestamptz,
  "published_at" timestamptz,
  "failed_at" timestamptz,
  "archived_at" timestamptz,
  "failure_reason" text,
  "approved_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL
);

-- 5. Unique index: one translation per (entity_type, entity_id, target_language_code)
CREATE UNIQUE INDEX IF NOT EXISTS "ct_entity_lang_unique"
  ON "content_translations"("entity_type", "entity_id", "target_language_code");
