import { defineConfig, devices } from '@playwright/test';

import type { WorkerOptions } from './src/fixtures/pom.fixtures';

/**
 * Playwright configuration for the Amtrak "Find trains" suite.
 *
 * Key decisions (see docs/FRAMEWORK.md for the rationale):
 *  - `fullyParallel` + `workers: 4`  -> four parallel workers by default.
 *  - `baseURL`                       -> tests navigate with relative paths ('/home').
 *  - `trace` / `screenshot` / `video`-> captured only when a test fails or retries.
 *  - `globalSetup`                   -> one reachability probe against amtrak.com; the
 *                                      per-test readiness check in the POM fixture will
 *                                      `test.skip()` gracefully if Akamai blocks the widget.
 */
export default defineConfig<WorkerOptions>({
  testDir: './tests',
  outputDir: './test-results',

  // Fail the build if `test.only` is committed.
  forbidOnly: !!process.env.CI,

  fullyParallel: true,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 4,
  // `mocked*` projects stub the live autocomplete. Single-leg tests are solid at 0
  // retries; the multi-city *submit* (switch trip type → 2 leg rows → 4 autocompletes
  // → 2 calendars) is the one fill heavy enough to still race the Angular widget, so
  // the budget is 2 and only that test tends to use the 2nd. `live-chromium` also
  // fights bot-protection + network latency. See docs/APPROACH.md ➜ "Known risks".
  retries: 2,

  timeout: 90_000,
  expect: { timeout: 15_000 },

  globalSetup: require.resolve('./tests/_support/global-setup'),

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://www.amtrak.com',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },

  projects: [
    // ---- Deterministic lane: stubbed autocomplete, no retries. This is the lane that
    //      must be green. It still drives the real Angular widget end to end — only the
    //      station-lookup network response is canned. ----
    {
      name: 'mocked-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: ['--disable-blink-features=AutomationControlled'] },
        mockAmtrakApi: true,
      },
    },
    {
      // Bonus lane — the Pixel 7 viewport is more interaction-fragile than desktop.
      name: 'mocked-mobile',
      use: { ...devices['Pixel 7'], mockAmtrakApi: true },
    },

    // ---- Live lane: real site, real autocomplete. Catches API-shape drift the mocks
    //      can't. Bot-protected + latency-prone, so it gets retries and is allowed to
    //      skip (see the `test.skip` in pom.fixtures.ts). ----
    {
      name: 'live-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: ['--disable-blink-features=AutomationControlled'] },
      },
    },
  ],
});
