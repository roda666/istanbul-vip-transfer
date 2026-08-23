CREATE TYPE "public"."fx_mode" AS ENUM('LIVE', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."included_km_mode" AS ENUM('PER_HOUR', 'PACKAGE');--> statement-breakpoint
CREATE TYPE "public"."pricing_mode" AS ENUM('DISTANCE', 'HOURLY');--> statement-breakpoint
CREATE TYPE "public"."toll_point_type" AS ENUM('BRIDGE', 'TUNNEL', 'HIGHWAY');--> statement-breakpoint
CREATE TYPE "public"."vat_display_mode" AS ENUM('EXCLUDED', 'INCLUDED');--> statement-breakpoint
CREATE TABLE "exchange_rate_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"eur_try_micros" integer NOT NULL,
	"usd_try_micros" integer NOT NULL,
	"eur_usd_micros" integer NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"error_message" text,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "exchange_rate_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"eur_try_mode" "fx_mode" DEFAULT 'LIVE' NOT NULL,
	"eur_usd_mode" "fx_mode" DEFAULT 'LIVE' NOT NULL,
	"manual_eur_try_micros" integer,
	"manual_eur_usd_micros" integer,
	"refresh_minutes" integer DEFAULT 60 NOT NULL,
	"deviation_basis_points" integer DEFAULT 1000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "fixed_price_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"amount_kurus" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "optional_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"unit_amount" integer NOT NULL,
	"charge_type" text DEFAULT 'PER_BOOKING' NOT NULL,
	"maximum_quantity" integer DEFAULT 1 NOT NULL,
	"included_in_transfer" boolean DEFAULT false NOT NULL,
	"automatic_service_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "optional_services_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "price_quote_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid,
	"vehicle_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "route_toll_alternative_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alternative_id" uuid NOT NULL,
	"toll_point_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_toll_alternatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "toll_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "toll_point_type" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "toll_tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"toll_point_id" uuid NOT NULL,
	"vehicle_class" text NOT NULL,
	"amount_kurus" integer NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "vehicle_pricing_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"mode" "pricing_mode" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"distance_opening_kurus" integer,
	"distance_first_km_kurus" integer,
	"distance_threshold_km" integer,
	"distance_second_km_kurus" integer,
	"hourly_rate_kurus" integer,
	"minimum_hours" integer,
	"included_km_mode" "included_km_mode",
	"included_km" integer,
	"excess_km_kurus" integer,
	"excess_hour_kurus" integer,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "price_calculator_settings" ADD COLUMN "vat_rate_basis_points" integer DEFAULT 2000 NOT NULL;--> statement-breakpoint
ALTER TABLE "price_calculator_settings" ADD COLUMN "vat_display_mode" "vat_display_mode" DEFAULT 'EXCLUDED' NOT NULL;--> statement-breakpoint
ALTER TABLE "price_calculator_settings" ADD COLUMN "eur_rounding_kurus" integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE "price_calculator_settings" ADD COLUMN "usd_rounding_cents" integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE "price_calculator_settings" ADD COLUMN "try_rounding_kurus" integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE "price_calculator_settings" ADD COLUMN "settings_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "price_quote_snapshot_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "price_calculation_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "pricing_class" text DEFAULT 'minivan' NOT NULL;--> statement-breakpoint
UPDATE "vehicles"
SET "price_calculation_eligible" = true
WHERE lower("name") ~ '(vito|transporter|sprinter|midibüs|midibus|otobüs|otobus|bus)';--> statement-breakpoint
ALTER TABLE "exchange_rate_history" ADD CONSTRAINT "exchange_rate_history_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rate_settings" ADD CONSTRAINT "exchange_rate_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_price_overrides" ADD CONSTRAINT "fixed_price_overrides_route_id_transfer_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."transfer_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_price_overrides" ADD CONSTRAINT "fixed_price_overrides_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_price_overrides" ADD CONSTRAINT "fixed_price_overrides_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_price_overrides" ADD CONSTRAINT "fixed_price_overrides_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optional_services" ADD CONSTRAINT "optional_services_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optional_services" ADD CONSTRAINT "optional_services_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_quote_snapshots" ADD CONSTRAINT "price_quote_snapshots_route_id_transfer_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."transfer_routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_quote_snapshots" ADD CONSTRAINT "price_quote_snapshots_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_quote_snapshots" ADD CONSTRAINT "price_quote_snapshots_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_toll_alternative_items" ADD CONSTRAINT "route_toll_alternative_items_alternative_id_route_toll_alternatives_id_fk" FOREIGN KEY ("alternative_id") REFERENCES "public"."route_toll_alternatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_toll_alternative_items" ADD CONSTRAINT "route_toll_alternative_items_toll_point_id_toll_points_id_fk" FOREIGN KEY ("toll_point_id") REFERENCES "public"."toll_points"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_toll_alternatives" ADD CONSTRAINT "route_toll_alternatives_route_id_transfer_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."transfer_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "toll_points" ADD CONSTRAINT "toll_points_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "toll_points" ADD CONSTRAINT "toll_points_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD CONSTRAINT "toll_tariffs_toll_point_id_toll_points_id_fk" FOREIGN KEY ("toll_point_id") REFERENCES "public"."toll_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD CONSTRAINT "toll_tariffs_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD CONSTRAINT "toll_tariffs_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_pricing_profiles" ADD CONSTRAINT "vehicle_pricing_profiles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_pricing_profiles" ADD CONSTRAINT "vehicle_pricing_profiles_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_pricing_profiles" ADD CONSTRAINT "vehicle_pricing_profiles_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exchange_rate_history_fetched_idx" ON "exchange_rate_history" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "fixed_price_overrides_lookup_idx" ON "fixed_price_overrides" USING btree ("route_id","vehicle_id","active","valid_from","valid_until");--> statement-breakpoint
CREATE INDEX "price_quote_snapshots_route_vehicle_idx" ON "price_quote_snapshots" USING btree ("route_id","vehicle_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "route_toll_alternative_item_unique" ON "route_toll_alternative_items" USING btree ("alternative_id","toll_point_id");--> statement-breakpoint
CREATE INDEX "toll_tariffs_lookup_idx" ON "toll_tariffs" USING btree ("toll_point_id","vehicle_class","active","valid_from","valid_until");--> statement-breakpoint
CREATE INDEX "vehicle_pricing_profiles_lookup_idx" ON "vehicle_pricing_profiles" USING btree ("vehicle_id","mode","active","valid_from","valid_until");--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD CONSTRAINT "reservation_requests_price_quote_snapshot_id_price_quote_snapshots_id_fk" FOREIGN KEY ("price_quote_snapshot_id") REFERENCES "public"."price_quote_snapshots"("id") ON DELETE set null ON UPDATE no action;