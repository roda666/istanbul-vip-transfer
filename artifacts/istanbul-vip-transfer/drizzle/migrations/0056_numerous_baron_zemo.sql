CREATE TABLE "email_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipient" text NOT NULL,
	"source" text NOT NULL,
	"request_reference" text,
	"admin_user_id" uuid,
	"result_code" text NOT NULL,
	"accepted" boolean NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"smtp_response_code" integer,
	"server_response" text NOT NULL,
	"message_id" text
);
--> statement-breakpoint
ALTER TABLE "email_delivery_attempts" ADD CONSTRAINT "email_delivery_attempts_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_delivery_attempts_occurred_at_idx" ON "email_delivery_attempts" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "email_delivery_attempts_request_reference_idx" ON "email_delivery_attempts" USING btree ("request_reference");