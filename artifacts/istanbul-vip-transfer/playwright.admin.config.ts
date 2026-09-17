import { defineConfig, devices } from '@playwright/test';

// Use `pnpm test:admin-acceptance`: invoking Playwright directly bypasses the
// signal-aware runner and therefore cannot guarantee cleanup after interruption.
const port = process.env.PORT ?? '26004';
// IPv4 is intentional: the preview proxy/container may advertise localhost as
// ::1 even though the Next listener is only reachable on the IPv4 loopback.
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${port}`;

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