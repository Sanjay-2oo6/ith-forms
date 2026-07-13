import { defineConfig, devices } from "@playwright/test";

/**
 * E2E + visual regression config.
 *
 * Environment variables (put them in your shell or a .env loaded by your
 * runner — Playwright does NOT read .env automatically):
 *   E2E_BASE_URL        — app under test (default http://localhost:3000)
 *   E2E_ADMIN_EMAIL     — admin login used by admin-flow specs
 *   E2E_ADMIN_PASSWORD  — admin password
 *
 * Admin-dependent specs skip themselves when credentials are absent, so the
 * public-form and visual suites still run standalone.
 *
 * `npm run test:e2e` starts the dev server automatically via webServer below
 * (reuses an already-running one on :3000).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false, // admin specs share created fixtures sequentially
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      // Tolerate minor anti-aliasing differences across GPUs/OSes.
      maxDiffPixelRatio: 0.02,
    },
  },
  projects: [
    {
      name: "e2e",
      testIgnore: /visual\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "visual",
      testMatch: /visual\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
