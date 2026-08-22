CREATE TABLE "transfer_route_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"language_code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"og_title" text,
	"og_description" text,
	"status" "translation_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"is_manually_locked" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "og_title" text;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "og_description" text;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "related_service_slug" text;--> statement-breakpoint
ALTER TABLE "transfer_routes" ADD COLUMN "indexable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "transfer_route_translations" ADD CONSTRAINT "transfer_route_translations_route_id_transfer_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."transfer_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_route_translations_route_locale_unique" ON "transfer_route_translations" USING btree ("route_id","language_code");--> statement-breakpoint
CREATE INDEX "transfer_route_translations_route_status_idx" ON "transfer_route_translations" USING btree ("route_id","status");--> statement-breakpoint
-- Existing routes receive complete source copy and language-native public drafts.
UPDATE "transfer_routes"
SET
  "description" = COALESCE("description", "origin" || ' ile ' || "destination" || ' arasındaki VIP transferiniz için Mercedes Vito ve Sprinter araç seçenekleriyle, deneyimli şoförlerimiz 7/24 hizmetinizdedir.'),
  "seo_title" = COALESCE("seo_title", "name" || ' | İstanbul VIP Transfer'),
  "seo_description" = COALESCE("seo_description", "origin" || ' - ' || "destination" || ' VIP transferi için konforlu araç ve profesyonel şoför hizmeti.'),
  "og_title" = COALESCE("og_title", "name" || ' | İstanbul VIP Transfer'),
  "og_description" = COALESCE("og_description", "origin" || ' ile ' || "destination" || ' arasında güvenli ve konforlu VIP transfer.'),
  "related_service_slug" = COALESCE("related_service_slug", CASE
    WHEN lower("name") LIKE '%sabiha%' THEN 'sabiha-gokcen-havalimani-transfer'
    WHEN lower("name") LIKE '%havaliman%' OR lower("name") LIKE '%airport%' THEN 'istanbul-havalimani-transfer'
    WHEN lower("name") LIKE '%bursa%' THEN 'istanbul-bursa-transfer'
    WHEN lower("name") LIKE '%ankara%' THEN 'ankara-vip-transfer'
    WHEN lower("name") LIKE '%antalya%' THEN 'antalya-vip-transfer'
    WHEN lower("name") LIKE '%izmir%' OR lower("name") LIKE '%i̇zmir%' THEN 'izmir-vip-transfer'
    ELSE 'vip-transfer'
  END);--> statement-breakpoint
INSERT INTO "transfer_route_translations" (
  "route_id", "language_code", "title", "description", "seo_title", "seo_description",
  "og_title", "og_description", "status", "published_at"
)
SELECT r."id", locale.code, COALESCE(r."name_translations" ->> locale.code, r."name"),
  CASE locale.code
    WHEN 'en' THEN 'Enjoy a comfortable private VIP transfer from ' || COALESCE(r."origin_translations" ->> locale.code, r."origin") || ' to ' || COALESCE(r."destination_translations" ->> locale.code, r."destination") || ' with professional chauffeurs and Mercedes Vito or Sprinter vehicles, available 24/7.'
    WHEN 'de' THEN 'Genießen Sie einen komfortablen privaten VIP-Transfer von ' || COALESCE(r."origin_translations" ->> locale.code, r."origin") || ' nach ' || COALESCE(r."destination_translations" ->> locale.code, r."destination") || ' mit professionellen Fahrern und Mercedes Vito oder Sprinter Fahrzeugen, rund um die Uhr.'
    WHEN 'ru' THEN 'Комфортный частный VIP-трансфер из ' || COALESCE(r."origin_translations" ->> locale.code, r."origin") || ' в ' || COALESCE(r."destination_translations" ->> locale.code, r."destination") || ' с профессиональными водителями и автомобилями Mercedes Vito или Sprinter доступен 24/7.'
    WHEN 'ar' THEN 'استمتع بنقل VIP خاص ومريح من ' || COALESCE(r."origin_translations" ->> locale.code, r."origin") || ' إلى ' || COALESCE(r."destination_translations" ->> locale.code, r."destination") || ' مع سائقين محترفين وسيارات مرسيدس فيتو أو سبرينتر على مدار الساعة.'
    WHEN 'fr' THEN 'Profitez d''un transfert VIP privé et confortable de ' || COALESCE(r."origin_translations" ->> locale.code, r."origin") || ' à ' || COALESCE(r."destination_translations" ->> locale.code, r."destination") || ' avec chauffeurs professionnels et véhicules Mercedes Vito ou Sprinter, disponibles 24h/24.'
    WHEN 'es' THEN 'Disfrute de un traslado VIP privado y cómodo de ' || COALESCE(r."origin_translations" ->> locale.code, r."origin") || ' a ' || COALESCE(r."destination_translations" ->> locale.code, r."destination") || ' con conductores profesionales y vehículos Mercedes Vito o Sprinter disponibles las 24 horas.'
    WHEN 'it' THEN 'Goditi un trasferimento VIP privato e confortevole da ' || COALESCE(r."origin_translations" ->> locale.code, r."origin") || ' a ' || COALESCE(r."destination_translations" ->> locale.code, r."destination") || ' con autisti professionisti e veicoli Mercedes Vito o Sprinter disponibili 24 ore su 24.'
    WHEN 'nl' THEN 'Geniet van een comfortabele privé VIP-transfer van ' || COALESCE(r."origin_translations" ->> locale.code, r."origin") || ' naar ' || COALESCE(r."destination_translations" ->> locale.code, r."destination") || ' met professionele chauffeurs en Mercedes Vito- of Sprinter-voertuigen, 24 uur per dag beschikbaar.'
  END,
  COALESCE(r."name_translations" ->> locale.code, r."name") || ' | Istanbul VIP Transfer',
  COALESCE(r."name_translations" ->> locale.code, r."name") || ' — Istanbul VIP Transfer',
  COALESCE(r."name_translations" ->> locale.code, r."name") || ' | Istanbul VIP Transfer',
  COALESCE(r."name_translations" ->> locale.code, r."name") || ' — Istanbul VIP Transfer',
  'PUBLISHED', now()
FROM "transfer_routes" r
CROSS JOIN (VALUES ('en'), ('de'), ('ru'), ('ar'), ('fr'), ('es'), ('it'), ('nl')) AS locale(code)
WHERE
  COALESCE(r."name_translations" ->> locale.code, '') <> ''
  AND COALESCE(r."origin_translations" ->> locale.code, '') <> ''
  AND COALESCE(r."destination_translations" ->> locale.code, '') <> ''
ON CONFLICT ("route_id", "language_code") DO NOTHING;