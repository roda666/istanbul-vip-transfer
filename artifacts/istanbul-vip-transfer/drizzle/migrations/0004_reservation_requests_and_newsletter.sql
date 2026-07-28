-- Migration 0004: Add reservation_requests, newsletter_subscribers, newsletter_consent_events

-- 1. New enums
DO $$ BEGIN
  CREATE TYPE "public"."request_intent" AS ENUM('QUOTE', 'RESERVATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."request_status" AS ENUM(
    'NEW', 'CONTACTED', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'SPAM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."newsletter_status" AS ENUM('PENDING', 'ACTIVE', 'UNSUBSCRIBED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. reservation_requests
CREATE TABLE IF NOT EXISTS "reservation_requests" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference_number" text NOT NULL UNIQUE,
  "intent"           "request_intent" NOT NULL,
  "service_type"     text NOT NULL,
  "name"             text NOT NULL,
  "phone"            text NOT NULL,
  "normalized_email" text,
  "locale"           text NOT NULL DEFAULT 'tr',
  "request_data"     jsonb NOT NULL DEFAULT '{}',
  "status"           "request_status" NOT NULL DEFAULT 'NEW',
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  "archived_at"      timestamptz
);

CREATE INDEX IF NOT EXISTS "rr_status_idx"     ON "reservation_requests" ("status");
CREATE INDEX IF NOT EXISTS "rr_service_idx"    ON "reservation_requests" ("service_type");
CREATE INDEX IF NOT EXISTS "rr_intent_idx"     ON "reservation_requests" ("intent");
CREATE INDEX IF NOT EXISTS "rr_created_idx"    ON "reservation_requests" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "rr_email_idx"      ON "reservation_requests" ("normalized_email");
CREATE INDEX IF NOT EXISTS "rr_archived_idx"   ON "reservation_requests" ("archived_at");

-- 3. newsletter_subscribers
CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "normalized_email"   text NOT NULL UNIQUE,
  "name"               text,
  "preferred_language" text NOT NULL DEFAULT 'tr',
  "status"             "newsletter_status" NOT NULL DEFAULT 'PENDING',
  "source"             text NOT NULL,
  "created_at"         timestamptz NOT NULL DEFAULT now(),
  "updated_at"         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ns_status_idx"   ON "newsletter_subscribers" ("status");
CREATE INDEX IF NOT EXISTS "ns_language_idx" ON "newsletter_subscribers" ("preferred_language");

-- 4. newsletter_consent_events
CREATE TABLE IF NOT EXISTS "newsletter_consent_events" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscriber_id"        uuid REFERENCES "newsletter_subscribers"("id") ON DELETE CASCADE,
  "normalized_email"     text NOT NULL,
  "action"               text NOT NULL,
  "consent_text_version" text NOT NULL,
  "language"             text NOT NULL,
  "source"               text NOT NULL,
  "created_at"           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "nce_subscriber_idx" ON "newsletter_consent_events" ("subscriber_id");
CREATE INDEX IF NOT EXISTS "nce_email_idx"      ON "newsletter_consent_events" ("normalized_email");
