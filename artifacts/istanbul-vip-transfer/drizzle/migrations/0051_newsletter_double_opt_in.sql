CREATE TABLE IF NOT EXISTS "newsletter_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscriber_id" uuid NOT NULL REFERENCES "newsletter_subscribers"("id") ON DELETE cascade,
  "token_hash" text NOT NULL UNIQUE,
  "purpose" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "newsletter_tokens_subscriber_purpose_idx" ON "newsletter_tokens" USING btree ("subscriber_id","purpose");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "newsletter_tokens_expires_at_idx" ON "newsletter_tokens" USING btree ("expires_at");