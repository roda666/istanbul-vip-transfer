ALTER TABLE "content" ADD COLUMN "is_homepage_source" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "content"
SET "is_homepage_source" = true
WHERE "slug" = 'ana-sayfa';