ALTER TABLE "chatbot_messages"
  ADD COLUMN IF NOT EXISTS "processing_status" text NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS "processing_token" text,
  ADD COLUMN IF NOT EXISTS "processing_lease_until" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "chatbot_messages_processing_lease_idx"
  ON "chatbot_messages" ("session_id", "client_message_id", "processing_status", "processing_lease_until");