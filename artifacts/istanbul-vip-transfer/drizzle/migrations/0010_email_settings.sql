-- Migration: email_settings table
-- Singleton row (id = 1) that stores SMTP configuration.
-- smtp_pass_encrypted holds AES-256-GCM ciphertext produced by lib/email-crypto.ts.
-- The plaintext password is NEVER stored and NEVER returned to the client.

CREATE TABLE IF NOT EXISTS "email_settings" (
  "id"                   integer        PRIMARY KEY DEFAULT 1,
  "enabled"              boolean        DEFAULT false NOT NULL,
  "provider_type"        text           DEFAULT 'custom' NOT NULL,
  "smtp_host"            text,
  "smtp_port"            integer        DEFAULT 587,
  "smtp_secure"          text           DEFAULT 'tls' NOT NULL,
  "smtp_user"            text,
  "smtp_pass_encrypted"  text,
  "from_name"            text,
  "from_email"           text,
  "reply_to_email"       text,
  "admin_notify_emails"  text,
  "updated_at"           timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by"           uuid           REFERENCES "admin_users"("id") ON DELETE SET NULL
);

--> statement-breakpoint
INSERT INTO "email_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
