CREATE TABLE IF NOT EXISTS "admin_section_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" uuid NOT NULL,
  "section" text NOT NULL,
  "can_view" boolean DEFAULT false NOT NULL,
  "can_manage" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "admin_section_grants_admin_user_id_admin_users_id_fk"
    FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade,
  CONSTRAINT "admin_section_grants_user_section_unique" UNIQUE ("admin_user_id", "section")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_section_grants_admin_user_id_idx"
  ON "admin_section_grants" USING btree ("admin_user_id");
--> statement-breakpoint
-- Materialize the pre-grants role policy for existing accounts.  New accounts
-- intentionally receive no rows and therefore no section access.
INSERT INTO "admin_section_grants" ("admin_user_id", "section", "can_view", "can_manage")
SELECT u.id, v.section,
  CASE v.section
    WHEN 'dashboard' THEN u.role IN ('ADMIN', 'EDITOR')
    WHEN 'requests' THEN u.role = 'ADMIN'
    WHEN 'transfer_operations' THEN u.role = 'ADMIN'
    WHEN 'analytics' THEN u.role = 'ADMIN'
    WHEN 'reservation_settings' THEN u.role = 'ADMIN'
    WHEN 'chat' THEN u.role IN ('ADMIN', 'CHAT_STAFF')
    WHEN 'chatbot' THEN u.role = 'ADMIN'
    WHEN 'newsletter' THEN u.role = 'ADMIN'
    WHEN 'fleet_pricing' THEN u.role = 'ADMIN'
    WHEN 'content' THEN u.role IN ('ADMIN', 'EDITOR')
    WHEN 'translations' THEN u.role IN ('ADMIN', 'EDITOR')
    WHEN 'ai_content' THEN u.role IN ('ADMIN', 'EDITOR')
    WHEN 'site_navigation' THEN u.role IN ('ADMIN', 'EDITOR')
    WHEN 'site_settings' THEN u.role = 'ADMIN'
    WHEN 'security_settings' THEN false
    WHEN 'integrations' THEN false
    WHEN 'audit' THEN u.role = 'ADMIN'
    WHEN 'database_backup' THEN false
  END,
  CASE v.section
    WHEN 'requests' THEN u.role = 'ADMIN'
    WHEN 'transfer_operations' THEN u.role = 'ADMIN'
    WHEN 'reservation_settings' THEN u.role = 'ADMIN'
    WHEN 'chat' THEN u.role IN ('ADMIN', 'CHAT_STAFF')
    WHEN 'chatbot' THEN u.role = 'ADMIN'
    WHEN 'newsletter' THEN u.role = 'ADMIN'
    WHEN 'fleet_pricing' THEN u.role = 'ADMIN'
    WHEN 'content' THEN u.role IN ('ADMIN', 'EDITOR')
    WHEN 'translations' THEN u.role IN ('ADMIN', 'EDITOR')
    WHEN 'ai_content' THEN u.role IN ('ADMIN', 'EDITOR')
    WHEN 'site_navigation' THEN u.role IN ('ADMIN', 'EDITOR')
    WHEN 'site_settings' THEN u.role = 'ADMIN'
    ELSE false
  END
FROM "admin_users" u
CROSS JOIN (VALUES
  ('dashboard'), ('requests'), ('transfer_operations'), ('analytics'),
  ('reservation_settings'), ('chat'), ('chatbot'), ('newsletter'),
  ('fleet_pricing'), ('content'), ('translations'), ('ai_content'),
  ('site_navigation'), ('site_settings'), ('security_settings'),
  ('integrations'), ('audit'), ('database_backup')
) AS v(section)
WHERE u.role <> 'SUPER_ADMIN'
ON CONFLICT ("admin_user_id", "section") DO NOTHING;