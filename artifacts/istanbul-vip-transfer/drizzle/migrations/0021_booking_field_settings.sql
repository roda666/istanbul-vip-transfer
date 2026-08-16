-- Migration 0021: Booking form field visibility settings
-- Adds 4 optional fields that admin can toggle on/off for the public booking form
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS show_luggage_count boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_child_seat_count boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_vehicle_preference boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_additional_notes boolean NOT NULL DEFAULT false;
