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
  // Retries are set per-project (below), not globally: the deterministic gate
  // (`mocked-chromium`) runs at 0 — a failure there is a real bug, not something to
  // retry away. Only `live-chromium`, which fights bot-protection + latency, gets a
  // budget. See docs/APPROACH.md ➜ "Known risks".
  retries: 0,

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
    // `retain-on-failure`, not `on-first-retry`: the gate runs at 0 retries, so a trace
    // has to be captured on the first (only) failure to be any use.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },

  projects: [
    // ---- Deterministic gate: stubbed autocomplete, 0 retries. Must be green. It still
    //      drives the real Angular widget end to end — only the station-lookup network
    //      response is canned. A non-ready widget here fails (see pom.fixtures.ts). ----
    {
      name: 'mocked-chromium',
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: ['--disable-blink-features=AutomationControlled'] },
        mockAmtrakApi: true,
      },
    },
    {
      // Bonus lane, not a gate — the Pixel 7 viewport is more interaction-fragile than
      // desktop, so it gets a single retry.
      name: 'mocked-mobile',
      retries: 1,
      use: { ...devices['Pixel 7'], mockAmtrakApi: true },
    },

    // ---- Live lane: real site, real autocomplete. Catches API-shape drift the mocks
    //      can't. Bot-protected + latency-prone, so it gets retries and is allowed to
    //      skip (see the `test.skip` in pom.fixtures.ts). Not a gate. ----
    {
      name: 'live-chromium',
      retries: 2,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: ['--disable-blink-features=AutomationControlled'] },
      },
    },
  ],
});
