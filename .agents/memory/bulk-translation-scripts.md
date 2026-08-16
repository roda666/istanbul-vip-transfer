---
name: Bulk translation scripts
description: Standalone .mjs scripts for translating blog posts and service pages — module resolution fix for pnpm monorepo
---

## Rule
Standalone `.mjs` translation scripts for istanbul-vip-transfer must import from `../node_modules/` (one level up from `scripts/`), not `./node_modules/`.

**Why:** pnpm installs packages in `artifacts/istanbul-vip-transfer/node_modules/` (symlinks to pnpm store), not `scripts/node_modules/`. The `./` prefix resolves to the wrong directory.

**How to apply:** Any new .mjs script in `artifacts/istanbul-vip-transfer/scripts/` that needs `postgres` or `openai`:
```js
import postgres from '../node_modules/postgres/cjs/src/index.js';
import OpenAI from '../node_modules/openai/index.js';
```

## Service page content_type
The `content` table uses `content_type::text = 'SERVICE'` (not 'SERVICE_PAGE') for service pages. Querying with `content_type = 'SERVICE_PAGE'` fails with enum error. Use `content_type::text = 'SERVICE'` to bypass the enum in raw SQL.

## Translation status field
`PublishedServicePage` interface now includes `translationStatus: 'OUTDATED' | null`. Non-TR pages return `tx.status === 'OUTDATED' ? 'OUTDATED' : null`. TR pages return `null`.

## Hero images
Generated 14 service page hero images via Replit managed `generateImage` callback (not DALL-E 3 — blocked by current API key). Images saved to `public/hero-images/{slug}.jpg`. DB updated with `/hero-images/{slug}.jpg` serve URLs. DALL-E 3 direct access fails with "model does not exist" with current OPENAI_API_KEY (probably proxy key).
