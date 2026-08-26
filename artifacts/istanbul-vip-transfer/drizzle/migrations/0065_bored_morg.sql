CREATE TYPE "public"."toll_direction" AS ENUM('ONE_WAY', 'TWO_WAY_SAME', 'TWO_WAY_DIRECTIONAL');--> statement-breakpoint
CREATE TYPE "public"."toll_pricing_mode" AS ENUM('FLAT', 'GATE_PAIR');--> statement-breakpoint
CREATE TYPE "public"."toll_tariff_direction" AS ENUM('FORWARD', 'BACKWARD');--> statement-breakpoint
ALTER TABLE "route_toll_alternative_items" ADD COLUMN "entry_gate_name" text;--> statement-breakpoint
ALTER TABLE "route_toll_alternative_items" ADD COLUMN "exit_gate_name" text;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "toll_direction" "toll_direction";--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "toll_direction_source_url" text;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "toll_direction_notes" text;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "pricing_mode" "toll_pricing_mode" DEFAULT 'FLAT' NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "entry_gate_name" text;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "exit_gate_name" text;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "direction" "toll_tariff_direction";