/**
 * Playwright configuration for Istanbul VIP Transfer.
 *
 * Run against the already-running dev server (port 26004):
 *   pnpm --filter @workspace/istanbul-vip-transfer run test:e2e
 *
 * To override the base URL (e.g. in CI against a different port):
 *   BASE_URL=http://localhost:3000 pnpm ... run test:e2e
 */
import { defineConfig, devices } from '@playwright/test';

const PORT     = process.env.PORT ?? '26004';
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir:   './tests',
  testMatch: '**/*.spec.ts',
  timeout:   30_000,
  retries:   1,
  workers:   4,

  use: {
    baseURL:       BASE_URL,
    // Service pages use framer-motion animations; wait for network idle so
    // the H1 has time to appear in the DOM before assertions.
    actionTimeout: 10_000,
    // Capture screenshots only on failure to keep test runs fast.
    screenshot:    'only-on-failure',
  },

  projects: [
    {
      name:    'chromium',
      use:     { ...devices['Desktop Chrome'] },
    },
  ],

  // Do NOT start a webServer here — the dev server is managed by Replit
  // workflows.  Tests assume it is already running on BASE_URL.
});
