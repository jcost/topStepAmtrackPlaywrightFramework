import { defineConfig, devices } from '@playwright/test';

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
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',

  // Fail the build if `test.only` is committed.
  forbidOnly: !!process.env.CI,

  fullyParallel: true,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 4,
  // One local retry absorbs the occasional slow autocomplete response from the live
  // (bot-protected) Amtrak site; CI gets two. See docs/APPROACH.md ➜ "Known risks".
  retries: process.env.CI ? 2 : 1,

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
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // Reduce the most obvious automation signal without spoofing the UA string.
        launchOptions: { args: ['--disable-blink-features=AutomationControlled'] },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
