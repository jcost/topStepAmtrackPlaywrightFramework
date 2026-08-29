import { test as base, expect } from '@playwright/test';

import { HomePage } from '../pages/home.page';
import { seedAmtrakConsent } from '../support/consent';
import { mockAmtrakStationAutocomplete } from '../support/mocks/amtrak-routes';

/**
 * Fixture-based Page Object injection.
 *
 * Specs import `test` / `expect` from THIS file (never from `@playwright/test` — the
 * ESLint guard enforces that). Every Page Object is created once per test and handed
 * to the spec through the test callback args, so specs never call `new SomePage()`.
 *
 * ➕ To add a page surface:
 *    1. Create `src/pages/<name>.page.ts` (extends BasePage).
 *    2. Add it to `PageObjects` below.
 *    3. Add a fixture entry in `base.extend(...)`.
 *    That is the only supported way to get a Page Object into a test.
 */
export interface PageObjects {
  homePage: HomePage;
}

export interface WorkerOptions {
  /** Project option — when true, the live station autocomplete is stubbed (mock lane). */
  mockAmtrakApi: boolean;
}

export const test = base.extend<PageObjects & WorkerOptions>({
  mockAmtrakApi: [false, { option: true }],

  homePage: async ({ page, mockAmtrakApi }, use) => {
    // Routes must be registered before the page navigates.
    if (mockAmtrakApi) {
      await mockAmtrakStationAutocomplete(page);
    }
    await seedAmtrakConsent(page.context());
    const homePage = new HomePage(page);
    await homePage.open();
    await use(homePage);
  },
});

/**
 * Graceful degradation: amtrak.com sits behind Akamai bot management. When the
 * "Find trains" widget fails to load (bot wall, outage, offline CI), skip with a
 * clear reason instead of a wall of red failures.
 */
test.beforeEach(async ({ homePage }) => {
  const ready = await homePage.findTrainsForm.isReady();
  test.skip(
    !ready,
    'Amtrak "Find trains" widget did not load (bot protection / network). See docs/APPROACH.md ➜ "Known risks".',
  );
});

export { expect };
