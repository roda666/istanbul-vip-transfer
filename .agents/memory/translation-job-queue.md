---
name: Translation Job Queue
description: DB-backed per-language AI translation queue replacing the old single-request endpoint; architecture, tables, routes, and UI patterns.
---

## Architecture

Frontend-orchestrated job queue — no long-running single HTTP request:

1. `POST /admin/api/translations/jobs` — create job + N tasks (one per lang), returns immediately
2. Frontend processes tasks with **concurrency 2** using `concurrentForEach`
3. `POST /admin/api/translations/jobs/[jobId]/tasks/[taskId]/run` — runs ONE task (45s AbortController)
4. `GET /admin/api/translations/jobs/[jobId]` — poll for status
5. `POST /admin/api/translations/jobs/[jobId]/cancel` — cancel QUEUED/RETRYING tasks
6. `POST /admin/api/translations/jobs/[jobId]/retry-failed` — reset FAILED to QUEUED; accepts `{ force: true }` to override manually-locked

## DB Tables (migration 0013)

- `translation_jobs` — parent: entityType, entityId, status, force, total/completed/failedTasks
- `translation_job_tasks` — per-lang: jobId, targetLanguageCode, status, attempts, errorMessage, translationId

**Job status values:** QUEUED → RUNNING → COMPLETED | PARTIAL | FAILED | CANCELLED  
**Task status values:** QUEUED → RUNNING → COMPLETED | FAILED | RETRYING | CANCELLED  
Max 2 attempts per task; RETRYING is set when attempt < 2, FAILED when attempt == 2.

## Key files

- `lib/translation-job-runner.ts` — fetches entity, calls AI, saves DRAFT; use `parse_error` (not `json_parse`) for retry condition
- `lib/safe-fetch-json.ts` — `safeJson(res, context)` and `safeFetch(url, init, context)` — always check Content-Type before calling `.json()`
- `app/admin/api/translations/jobs/` — all 5 routes
- `components/AiTranslateButton.tsx` — blog editor button, now job-based
- `app/admin/(protected)/dil-ve-ceviri/_DilVeCeviriClient.tsx` — `CevirilerIsleriTab` uses job queue; imports `useRef` and `safeFetch/safeJson`

## Why

- Old `/admin/api/translations/ai` translated all 8 langs in a synchronous loop → 240s+ → proxy 504 → HTML error page → `res.json()` threw SyntaxError
- Job queue: each request ≤45s, browser refresh survives, retries are granular per-language

## Needs confirmation UX

Tasks that fail with `needs_confirmation` status show "Zorla Üzerine Yaz" button, which calls retry-failed with `{ force: true }` to set job.force=true and reset those tasks.

## Old route status

`/admin/api/translations/ai` (404 lines) still exists — deprecated but not removed. AiTranslateButton no longer calls it; _DilVeCeviriClient no longer calls it. Safe to remove in a future cleanup.
