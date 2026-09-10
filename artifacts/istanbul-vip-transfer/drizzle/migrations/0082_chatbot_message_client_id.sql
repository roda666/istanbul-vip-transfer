ALTER TABLE "chatbot_messages"
  ADD COLUMN IF NOT EXISTS "client_message_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "chatbot_messages_session_client_message_unique"
  ON "chatbot_messages" ("session_id", "client_message_id");