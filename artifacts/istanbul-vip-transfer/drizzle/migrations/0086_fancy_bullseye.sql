CREATE TYPE "public"."istanbul_side" AS ENUM('EUROPEAN', 'ASIAN', 'NONE');--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "istanbul_side" "istanbul_side" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "is_bosphorus_crossing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "bosphorus_crossing_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "toll_points" ADD COLUMN "is_default_bosphorus_crossing" boolean DEFAULT false NOT NULL;--> statement-breakpoint

UPDATE "locations"
SET "istanbul_side" = 'EUROPEAN'
WHERE "slug" = ANY (ARRAY[
    'arnavutkoy','avcilar','bagcilar','bahcelievler','bakirkoy','basaksehir',
    'bayrampasa','besiktas','beylikduzu','beyoglu','buyukcekmece','catalca',
    'esenler','esenyurt','eyupsultan','fatih','gaziosmanpasa','gungoren',
    'kagithane','kucukcekmece','sariyer','silivri','sultangazi','sisli',
    'zeytinburnu','ist-havalimani','ayasofya','dolmabahce-sarayi',
    'galata-kulesi','kapalicarsi','karakoy','miniaturk','ortakoy','sirkeci',
    'sultanahmet-meydani','taksim-meydani','topkapi-sarayi','istiklal-caddesi'
  ]);--> statement-breakpoint

UPDATE "locations"
SET "istanbul_side" = 'ASIAN'
WHERE "slug" = ANY (ARRAY[
    'adalar','atasehir','beykoz','cekmekoy','kadikoy','kartal','maltepe',
    'pendik','sancaktepe','sultanbeyli','sile','tuzla','umraniye','uskudar',
    'saw-sabiha-gokcen'
  ]);--> statement-breakpoint

DO $$
BEGIN
  IF (SELECT count(*) FROM "locations" WHERE "istanbul_side" = 'EUROPEAN') <> 38
     OR (SELECT count(*) FROM "locations" WHERE "istanbul_side" = 'ASIAN') <> 15 THEN
    RAISE EXCEPTION 'Istanbul-side seed did not classify exactly 38 European and 15 Asian locations';
  END IF;
END $$;--> statement-breakpoint

UPDATE "toll_points"
SET
  "is_bosphorus_crossing" = true,
  "bosphorus_crossing_order" = CASE "name"
    WHEN 'Fatih Sultan Mehmet Köprüsü (FSM)' THEN 10
    WHEN '15 Temmuz Şehitler Köprüsü' THEN 20
    WHEN 'Avrasya Tüneli' THEN 30
    WHEN 'Yavuz Sultan Selim Köprüsü (YSS)' THEN 40
  END,
  "is_default_bosphorus_crossing" = ("name" = 'Fatih Sultan Mehmet Köprüsü (FSM)')
WHERE "name" = ANY (ARRAY[
  'Fatih Sultan Mehmet Köprüsü (FSM)',
  '15 Temmuz Şehitler Köprüsü',
  'Avrasya Tüneli',
  'Yavuz Sultan Selim Köprüsü (YSS)'
]) AND "type" IN ('BRIDGE', 'TUNNEL');--> statement-breakpoint

DO $$
BEGIN
  IF (SELECT count(*) FROM "toll_points" WHERE "is_bosphorus_crossing") <> 4
     OR (SELECT count(*) FROM "toll_points" WHERE "is_default_bosphorus_crossing") <> 1 THEN
    RAISE EXCEPTION 'Bosphorus crossing seed did not classify exactly four points with one default';
  END IF;
END $$;