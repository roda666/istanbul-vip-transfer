ALTER TABLE "email_delivery_attempts" ADD COLUMN "link_origin_mode" text;--> statement-breakpoint
ALTER TABLE "email_delivery_attempts" ADD COLUMN "preview_domain_used" boolean DEFAULT false NOT NULL;