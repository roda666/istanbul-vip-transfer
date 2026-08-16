---
name: Chatbot hybrid system architecture
description: How the AI+admin hybrid live chat works — schema, routes, timing rules, and client flows.
---

## Schema (chatbot_sessions table)
- `id` TEXT PK — session ID, also used as HttpOnly cookie value (`ivt_chat_sid`)
- `visitor_lang` TEXT — detected from first request `lang` param
- `admin_active_until` TIMESTAMPTZ — temporary 2-min window (set by /takeover or /reply); while in future, AI skips streaming
- `human_taken_over` BOOLEAN DEFAULT FALSE — **permanent** flag; set to TRUE when admin sends first manual reply; AI never auto-responds again until explicitly released
- `pending_ai_after` TIMESTAMPTZ NULL — when humanTakenOver=true and visitor sends message, set to now+2min; AI resumes at this timestamp if admin doesn't reply
- `last_message_at`, `created_at` — standard timestamps

## AI response decision tree (POST /data/chatbot)
1. If `admin_active_until > now` → return `{ mode: 'admin' }` (temporary window)
2. If `human_taken_over = true`:
   a. If `pending_ai_after <= now` → reset both to false/null, fall through to AI streaming
   b. If `pending_ai_after > now` OR null → set/refresh `pending_ai_after = now+2min`, return `{ mode: 'admin' }`
3. Otherwise → stream AI response normally

## 2-minute fallback (GET /data/chatbot/[sessionId]/poll)
- Widget polls every 3s. If `human_taken_over=true` AND `pending_ai_after <= now`:
  - Atomic UPDATE claiming reset (only one concurrent poll wins)
  - Winner fetches full history, calls `generateAIReply()` (non-streaming), stores in DB
  - Returns `{ messages: [...aiMsg], aiModeRestored: true }`
- ChatWidget handles `aiModeRestored`: adds assistant message, clears adminMode + pending bubble

## Admin reply (POST /admin/api/chatbot/[sessionId]/reply)
- Sets `human_taken_over = true`, `pending_ai_after = null`, `admin_active_until = now+5min`
- Stores `role=admin`, `content=translatedToVisitorLang`, `contentTr=adminTypedTurkish`

## Takeover release (POST /admin/api/chatbot/[sessionId]/takeover?release=true)
- Resets `admin_active_until=null`, `human_taken_over=false`, `pending_ai_after=null`
- Soft takeover (no ?release): sets `admin_active_until = now+2min` only

## Session ownership
- HttpOnly cookie `ivt_chat_sid` (Path=/data/chatbot, SameSite=Strict, 24h)
- Body `sessionId` ignored; cookie is the only trusted proof
- Cookie refreshed on every valid request

## Shared AI logic: lib/chatbot-ai.ts
- `CHATBOT_MODEL` = env `OPENAI_CHATBOT_MODEL` ?? `gpt-4o-mini`
- `getOpenAIChatbot()` — prefers AI_INTEGRATIONS_OPENAI_API_KEY + BASE_URL, falls back to OPENAI_API_KEY
- `getSystemPrompt(lang)` — 5-language system prompts
- `generateAIReply(visitorLang, history)` — non-streaming, used by poll route

## Translation: lib/chatbot-translate.ts
- Both `translateToTurkish` and `translateFromTurkish` use `gpt-4o-mini` (fixed from broken gpt-5.6-luna)

## Admin panel (_SohbetClient.tsx)
- Notifications: audio beep + toast + title blink + red unread badge on new user messages
- Session list badges: 👤 Admin / 🤖 AI based on humanTakenOver
- Message display: user messages show TR translation prominently + "Orijinal:" for non-TR; admin messages show typed TR + "Çeviri:" for visitor-lang

**Why:** `humanTakenOver` permanent flag prevents AI from jumping back into an admin-managed conversation mid-thread. `pending_ai_after` gives admin a 2-minute grace window per message without making visitors wait forever.
