-- Migration 0002: Add PROVINCE location type, scope to locations, and service_types table

-- 1. Add PROVINCE value to location_type enum (must be outside a transaction block)
ALTER TYPE "public"."location_type" ADD VALUE IF NOT EXISTS 'PROVINCE';

-- 2. Create location_scope enum (idempotent)
DO $$ BEGIN
  CREATE TYPE "public"."location_scope" AS ENUM('LOCAL', 'INTERCITY', 'BOTH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add scope column to locations (idempotent)
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "scope" "location_scope" DEFAULT 'LOCAL' NOT NULL;

-- 4. Create service_types table (idempotent)
CREATE TABLE IF NOT EXISTS "service_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "quote_enabled" boolean DEFAULT true NOT NULL,
  "reservation_enabled" boolean DEFAULT true NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid REFERENCES "public"."admin_users"("id") ON DELETE set null,
  CONSTRAINT "service_types_key_unique" UNIQUE("key")
);
