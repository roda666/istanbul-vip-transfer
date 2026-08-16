-- Migration 0018: Transfer Routes table for "Popüler Transfer Bölgeleri" homepage section
-- Admin-managed, homepage-displayed route cards with pricing and images.

CREATE TABLE IF NOT EXISTS "transfer_routes" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"                  text NOT NULL,
  "origin"                text NOT NULL,
  "destination"           text NOT NULL,
  "distance_km"           integer NOT NULL,
  "duration_minutes"      integer NOT NULL,
  "price_vito_min_eur"    integer NOT NULL,
  "price_vito_max_eur"    integer NOT NULL,
  "price_sprinter_min_eur" integer NOT NULL,
  "price_sprinter_max_eur" integer NOT NULL,
  "image_path"            text,
  "display_order"         integer DEFAULT 0 NOT NULL,
  "active"                boolean DEFAULT true NOT NULL,
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"            timestamp with time zone DEFAULT now() NOT NULL
);
