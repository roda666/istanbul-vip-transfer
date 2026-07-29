-- 0005: Add ARCHIVED status to reservation_requests,
--       SUPPRESSED status to newsletter_subscribers,
--       admin_notes and source columns.
-- Additive only — no existing data is altered.

--> statement-breakpoint
ALTER TYPE "request_status" ADD VALUE IF NOT EXISTS 'ARCHIVED';
--> statement-breakpoint
ALTER TYPE "newsletter_status" ADD VALUE IF NOT EXISTS 'SUPPRESSED';
--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN IF NOT EXISTS "admin_notes" text;
--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'booking-form';
