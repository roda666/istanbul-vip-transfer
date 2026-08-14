-- Migration: service_page_cms_columns
--
-- Adds three content-management columns to the `content` table to support
-- Services CMS phase: per-category grouping, homepage visibility flag, and
-- navigation visibility flag.  All have safe defaults so existing rows are
-- unaffected and the migration is zero-downtime.

ALTER TABLE "content"
  ADD COLUMN IF NOT EXISTS "category"         TEXT,
  ADD COLUMN IF NOT EXISTS "show_on_homepage" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "show_in_nav"      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "draft_body"       TEXT;
