DO $$ BEGIN
  CREATE TYPE "public"."transfer_operation_status" AS ENUM('PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "drivers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid
);
CREATE INDEX IF NOT EXISTS "drivers_active_idx" ON "drivers" ("is_active");
DO $$ BEGIN
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "transfer_operations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid UNIQUE,
  "planned_pickup_at" timestamptz NOT NULL,
  "pickup_location_summary" text NOT NULL,
  "dropoff_location_summary" text NOT NULL,
  "route_summary" text NOT NULL,
  "customer_summary" text NOT NULL,
  "vehicle_id" uuid,
  "driver_id" uuid,
  "status" "transfer_operation_status" DEFAULT 'PLANNED' NOT NULL,
  "assigned_at" timestamptz,
  "assigned_by" uuid,
  "unassigned_at" timestamptz,
  "unassigned_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid
);
CREATE INDEX IF NOT EXISTS "transfer_operations_pickup_idx" ON "transfer_operations" ("planned_pickup_at");
CREATE INDEX IF NOT EXISTS "transfer_operations_driver_pickup_idx" ON "transfer_operations" ("driver_id", "planned_pickup_at");
CREATE INDEX IF NOT EXISTS "transfer_operations_status_idx" ON "transfer_operations" ("status");
DO $$ BEGIN
  ALTER TABLE "transfer_operations" ADD CONSTRAINT "transfer_operations_request_id_reservation_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."reservation_requests"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN ALTER TABLE "transfer_operations" ADD CONSTRAINT "transfer_operations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "transfer_operations" ADD CONSTRAINT "transfer_operations_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "transfer_operations" ADD CONSTRAINT "transfer_operations_assigned_by_admin_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."admin_users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "transfer_operations" ADD CONSTRAINT "transfer_operations_unassigned_by_admin_users_id_fk" FOREIGN KEY ("unassigned_by") REFERENCES "public"."admin_users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "transfer_operations" ADD CONSTRAINT "transfer_operations_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "transfer_operations" ADD CONSTRAINT "transfer_operations_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "transfer_assignment_audits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transfer_operation_id" uuid NOT NULL,
  "action" text NOT NULL,
  "previous_driver_id" uuid,
  "driver_id" uuid,
  "previous_vehicle_id" uuid,
  "vehicle_id" uuid,
  "admin_user_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS "transfer_assignment_audits_transfer_idx" ON "transfer_assignment_audits" ("transfer_operation_id", "created_at");
DO $$ BEGIN
  ALTER TABLE "transfer_assignment_audits" ADD CONSTRAINT "transfer_assignment_audits_transfer_operation_id_fk" FOREIGN KEY ("transfer_operation_id") REFERENCES "public"."transfer_operations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN ALTER TABLE "transfer_assignment_audits" ADD CONSTRAINT "transfer_assignment_audits_previous_driver_id_fk" FOREIGN KEY ("previous_driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "transfer_assignment_audits" ADD CONSTRAINT "transfer_assignment_audits_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "transfer_assignment_audits" ADD CONSTRAINT "transfer_assignment_audits_previous_vehicle_id_fk" FOREIGN KEY ("previous_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "transfer_assignment_audits" ADD CONSTRAINT "transfer_assignment_audits_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "transfer_assignment_audits" ADD CONSTRAINT "transfer_assignment_audits_admin_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;