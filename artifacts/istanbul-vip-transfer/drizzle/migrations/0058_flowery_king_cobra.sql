ALTER TABLE "toll_tariffs" ADD COLUMN "automatic_amount_kurus" integer;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "manual_amount_kurus" integer;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "source_name" text;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "source_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "source_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "manual_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "toll_tariffs" ADD COLUMN "last_sync_error" text;
--> statement-breakpoint
-- Existing legacy tariff rows were entered manually. Preserve their effective
-- amount as an explicit manual override before the new source model takes over.
UPDATE "toll_tariffs"
SET "manual_amount_kurus" = "amount_kurus",
    "manual_updated_at" = "updated_at",
    "source_name" = COALESCE("source_name", 'MEVCUT MANUEL TARİFE')
WHERE "manual_amount_kurus" IS NULL;