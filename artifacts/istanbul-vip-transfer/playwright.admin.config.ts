import { defineConfig, devices } from '@playwright/test';

// Use `pnpm test:admin-acceptance`: invoking Playwright directly bypasses the
// signal-aware runner and therefore cannot guarantee cleanup after interruption.
const port = process.env.PORT ?? '26004';
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests',
  testMatch: 'admin-acceptance/**/*.spec.ts',
  timeout: 60_000,
  workers: 1,
  // Acceptance tests create their own isolated account, so retries only hide
  // infrastructure failures and are intentionally disabled.
  retries: 0,
  globalSetup: './playwright.admin-global-setup.ts',
  globalTeardown: './playwright.admin-global-teardown.ts',
  use: {
    baseURL,
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The Replit workflow owns the server lifecycle.
});