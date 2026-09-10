ALTER TABLE "chatbot_messages"
  ADD COLUMN IF NOT EXISTS "response_mode" text;