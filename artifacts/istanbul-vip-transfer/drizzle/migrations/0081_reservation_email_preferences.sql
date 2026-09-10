ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "admin_new_reservation_notification" boolean NOT NULL DEFAULT false;
ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "customer_confirmation_email" boolean NOT NULL DEFAULT false;