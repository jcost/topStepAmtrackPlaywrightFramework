import { request } from '@playwright/test';

/**
 * One cheap reachability probe before the run. It never fails the build — a blocked or
 * unreachable site is handled per-test by the readiness gate in the POM fixture (the live
 * lane skips, the mocked lanes fail). The log line just makes triage faster ("was it
 * blocked, or is a locator wrong?").
 */
async function globalSetup(): Promise<void> {
  const target = `${process.env.BASE_URL ?? 'https://www.amtrak.com'}/home`;
  try {
    const context = await request.newContext();
    const response = await context.get(target, { timeout: 30_000 });
    const status = response.status();
    console.log(`[global-setup] GET ${target} -> ${status}`);
    if (status >= 400) {
      console.warn('[global-setup] Non-OK status from Amtrak. Tests will skip if the widget is blocked.');
    }
    await context.dispose();
  } catch (error) {
    console.warn(
      `[global-setup] Could not reach Amtrak (${(error as Error).message}). Tests will skip if the widget does not load.`,
    );
  }
}

export default globalSetup;
