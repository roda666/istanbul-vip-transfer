---
name: AI Studio hardening
description: Key decisions and constraints for the AI Content Studio — timeouts, error sanitisation, Arabic RTL, idempotency, config check
---

## AbortSignal timeouts
- All OpenAI chat calls: `AbortSignal.timeout(90_000)` (90 s)
- Image generation: `AbortSignal.timeout(60_000)` (60 s)
- OpenAI connectivity check (config route): `AbortSignal.timeout(20_000)` (20 s)
- Passed as second arg to `client.chat.completions.create({...}, { signal })` — NOT via a separate AbortController

## Error sanitisation
- `sanitiseError()` in `ai-studio.ts` strips `/sk-[A-Za-z0-9_-]{10,}/g` and `Bearer \S+` before any message surfaces to client
- `classifyError()` maps to typed reason: `not_configured | rate_limited | api_error | parse_error | truncated`
- Billing/quota errors map to `rate_limited` reason (same retry UX)

## Arabic RTL — LTR protection
- `applyRtlLtrProtection(text)` in `ai-studio.ts` wraps phone numbers (`PHONE_PATTERN`) and airport codes (`AIRPORT_CODES`) with U+202A (LTR embedding) + U+202C (PDF)
- Called after AI response is received for `ar` lang — not injected into the system prompt
- Also applied to FAQ question/answer fields for Arabic

## Route idempotency
- `translations/route.ts`: check-then-upsert pattern (select existing → update OR insert); never duplicates rows
- `approve/route.ts`: checks `trApprovedAt` before inserting audit row — repeated approval returns `{alreadyApproved: true}` without extra audit entry
- `research/route.ts`: `DELETE` then `INSERT` (replace semantics — safe to retry)

## Config route — real pings
- `/admin/api/studio/config` runs: (1) `SELECT 1` DB ping, (2) real OpenAI chat completion with `max_tokens: 5`
- Returns full 9-language matrix, social/newsletter status, storage/scheduler flags
- Never returns any API key or secret fragment

## req.json() guards
- All routes wrap `await req.json()` in try/catch returning Turkish 400 error
- Routes where body is optional (draft) use `try { ... } catch { /* no body is fine */ }`

**Why:** Malformed JSON from network errors or browser quirks caused generic 500s. Turkish 400 messages are user-friendly in the admin panel context.

## DALL-E response_format (OpenAI SDK 6.x)
- SDK 6.49.0: `response_format: 'b64_json'` throws `400 Unknown parameter: 'response_format'`
- Fix: omit `response_format` entirely — defaults to URL; download from CDN URL then re-upload to storage
- `imageUrl` field replaced `b64Json` in `ImageGenResult` interface
- Image route now fetches CDN URL + re-uploads to GCS; falls back to temp CDN URL if storage not configured

## DB Migration application
- Migration 0016 (7 studio tables) was not applied to dev DB — apply with:
  `sed 's/--> statement-breakpoint/;/g' drizzle/migrations/0016_studio.sql | psql $DATABASE_URL`
- Production: `pnpm db:migrate` (safe — all CREATE TABLE IF NOT EXISTS)
- Config route now pings each studio table and returns `migrationApplied` + `tables` + `migrationGuide` in response
- Sistem Kontrolü page shows migration status with fix instructions

## QA test results (2026-08-15)
- 29 PASS, 0 FAIL, 2 WARN
- 8/8 language translations: EN/DE/RU/AR/FR/ES/IT/NL — real OpenAI calls
- TR draft: 347 words, SEO 70/100
- CMS DRAFT: isActive:false, publishedAt:null, showOnHomepage:false, archived after test
- DALL-E WARN: billing/quota in QA environment (code fixed for prod)
- AR RTL: bidi markers applied; QA content had no phone numbers (normal)
- Idempotency: 8 rows before = 8 rows after repeat EN save
