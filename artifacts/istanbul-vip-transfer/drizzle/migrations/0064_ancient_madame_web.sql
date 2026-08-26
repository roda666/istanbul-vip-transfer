CREATE TABLE "vehicle_toll_point_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"toll_point_id" uuid NOT NULL,
	"vehicle_class" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "classification_label" text;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "banned_vehicle_classes" jsonb;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "banned_vehicle_classes_source_url" text;--> statement-breakpoint
ALTER TABLE "vehicle_toll_point_classes" ADD CONSTRAINT "vehicle_toll_point_classes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_toll_point_classes" ADD CONSTRAINT "vehicle_toll_point_classes_toll_point_id_toll_points_id_fk" FOREIGN KEY ("toll_point_id") REFERENCES "public"."toll_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_toll_point_classes" ADD CONSTRAINT "vehicle_toll_point_classes_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_toll_point_classes" ADD CONSTRAINT "vehicle_toll_point_classes_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_toll_point_classes_unique" ON "vehicle_toll_point_classes" USING btree ("vehicle_id","toll_point_id");--> statement-breakpoint
ALTER TABLE "vehicles" DROP COLUMN "toll_class";