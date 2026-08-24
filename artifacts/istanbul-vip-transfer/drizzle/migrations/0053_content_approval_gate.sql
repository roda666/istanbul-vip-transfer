ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "approval_gate_enabled" boolean NOT NULL DEFAULT true;