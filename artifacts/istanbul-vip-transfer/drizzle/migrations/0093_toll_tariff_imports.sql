CREATE TABLE IF NOT EXISTS "toll_tariff_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "original_filename" text NOT NULL,
  "toll_point_id" uuid NOT NULL REFERENCES "toll_points"("id") ON DELETE restrict,
  "effective_date" timestamptz,
  "preview_json" jsonb NOT NULL,
  "preview_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PREVIEW',
  "parser_version" text NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "admin_users"("id") ON DELETE restrict,
  "confirmed_by" uuid REFERENCES "admin_users"("id") ON DELETE set null,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "confirmed_at" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "toll_tariff_imports_preview_hash_unique" ON "toll_tariff_imports" ("preview_hash");
CREATE INDEX IF NOT EXISTS "toll_tariff_imports_point_status_idx" ON "toll_tariff_imports" ("toll_point_id", "status");