import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });

// Fail immediately (instead of waiting for an unhealthy server) when the test DB is not configured.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is not set in .env — end-to-end tests need a separate "*_test" database (see README, section 5).');
}

const PORT = 3200;
const baseURL = `http://localhost:${PORT}`;

/**
 * End-to-end tests run a production build against the TEST database (TEST_DATABASE_URL),
 * which global-setup resets, migrates and seeds. Set PLAYWRIGHT_CHANNEL="" to use
 * Playwright's bundled Chromium (after `npx playwright install chromium`) instead of
 * the locally installed Google Chrome.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" },
    },
  ],
  webServer: {
    // Build first with `npm run build` (the e2e script does this for you).
    command: `npx next start -p ${PORT}`,
    url: `${baseURL}/api/health`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      NEXT_PUBLIC_SITE_URL: baseURL,
      BETTER_AUTH_URL: baseURL,
      EMAIL_PROVIDER: "console",
      SMS_PROVIDER: "none",
    },
  },
});
