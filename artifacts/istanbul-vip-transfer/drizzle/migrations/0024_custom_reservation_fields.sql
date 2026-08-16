-- Migration 0024: Admin-defined custom reservation fields per service
CREATE TABLE IF NOT EXISTS custom_reservation_fields (
  id           SERIAL PRIMARY KEY,
  label        TEXT NOT NULL,
  applies_to_slugs JSONB NOT NULL DEFAULT '[]',
  field_type   TEXT NOT NULL DEFAULT 'checkbox',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
