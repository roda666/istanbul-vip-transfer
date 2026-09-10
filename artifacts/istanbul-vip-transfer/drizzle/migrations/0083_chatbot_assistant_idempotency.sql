ALTER TABLE "chatbot_messages"
  ADD COLUMN IF NOT EXISTS "assistant_for_client_message_id" text,
  ADD COLUMN IF NOT EXISTS "action" jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS "chatbot_messages_session_assistant_outcome_unique"
  ON "chatbot_messages" ("session_id", "assistant_for_client_message_id")
  WHERE "assistant_for_client_message_id" IS NOT NULL;