CREATE TABLE "price_calculator_settings" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "route_price_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "route_id" uuid NOT NULL,
  "vehicle_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'EUR' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "valid_from" timestamp with time zone,
  "valid_until" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  CONSTRAINT "route_price_rules_amount_cents_positive" CHECK ("amount_cents" > 0),
  CONSTRAINT "route_price_rules_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "route_price_rules_validity_order" CHECK ("valid_from" IS NULL OR "valid_until" IS NULL OR "valid_from" <= "valid_until")
);
--> statement-breakpoint
ALTER TABLE "price_calculator_settings" ADD CONSTRAINT "price_calculator_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "route_price_rules" ADD CONSTRAINT "route_price_rules_route_id_transfer_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."transfer_routes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "route_price_rules" ADD CONSTRAINT "route_price_rules_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "route_price_rules" ADD CONSTRAINT "route_price_rules_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "route_price_rules" ADD CONSTRAINT "route_price_rules_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "route_price_rules_route_vehicle_idx" ON "route_price_rules" USING btree ("route_id", "vehicle_id");
--> statement-breakpoint
CREATE INDEX "route_price_rules_active_validity_idx" ON "route_price_rules" USING btree ("active", "valid_from", "valid_until");