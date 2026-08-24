CREATE TABLE "bot_protection_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_type" text NOT NULL,
	"reason" text NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"blocked_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bot_protection_metrics_bucket_unique" ON "bot_protection_metrics" USING btree ("form_type","reason","bucket_start");--> statement-breakpoint
CREATE INDEX "bot_protection_metrics_bucket_start_idx" ON "bot_protection_metrics" USING btree ("bucket_start");