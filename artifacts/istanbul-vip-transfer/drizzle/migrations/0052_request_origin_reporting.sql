ALTER TABLE "reservation_requests"
  ADD COLUMN IF NOT EXISTS "page_slug" text NOT NULL DEFAULT '/bilinmiyor';

CREATE INDEX IF NOT EXISTS "reservation_requests_page_slug_created_at_idx"
  ON "reservation_requests" ("page_slug", "created_at");