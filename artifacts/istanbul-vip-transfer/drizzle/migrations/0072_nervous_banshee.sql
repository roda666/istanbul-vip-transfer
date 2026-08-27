CREATE TABLE "vehicle_feature_defaults" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "vehicle_feature_defaults" ADD CONSTRAINT "vehicle_feature_defaults_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;