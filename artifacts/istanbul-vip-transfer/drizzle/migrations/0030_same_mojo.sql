CREATE TABLE "ai_draft_cadence_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_key" text NOT NULL,
	"period" text NOT NULL,
	"timezone" text NOT NULL,
	"planned_quantity" integer NOT NULL,
	"generated_count" integer DEFAULT 0 NOT NULL,
	"project_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"failure_message" text,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "ai_draft_cadence_runs_slot_key_unique" UNIQUE("slot_key")
);
--> statement-breakpoint
CREATE TABLE "ai_draft_cadence_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"period" text DEFAULT 'weekly' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"timezone" text DEFAULT 'Europe/Istanbul' NOT NULL,
	"last_executed_at" timestamp with time zone,
	"next_due_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "ai_draft_cadence_settings" ADD CONSTRAINT "ai_draft_cadence_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;