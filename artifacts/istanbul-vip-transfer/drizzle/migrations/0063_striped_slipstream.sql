ALTER TABLE "toll_tariffs" ALTER COLUMN "amount_kurus" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "day_start_hour" integer;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "night_start_hour" integer;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "toll_class" text;--> statement-breakpoint
ALTER TABLE "toll_pricing_settings" DROP COLUMN "day_start_hour";--> statement-breakpoint
ALTER TABLE "toll_pricing_settings" DROP COLUMN "night_start_hour";