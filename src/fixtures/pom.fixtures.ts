import { test as base, expect } from '@playwright/test';

import { HomePage } from '../pages/home.page';
import { seedAmtrakConsent } from '../support/consent';
import { mockAmtrakStationAutocomplete } from '../support/mocks/amtrak-routes';

/**
 * Fixture-based Page Object injection. Specs import `test` / `expect` from here (never from
 * `@playwright/test` — lint-enforced); Page Objects are created once per test and handed in
 * via the callback args. Adding a page surface: see docs/FRAMEWORK.md ➜ "Scaling".
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
 * Widget-readiness gate: on the **live** lane a non-ready widget means Akamai blocked the
 * run, so skip with a reason; on the **mocked** lanes it's a real regression, so fail.
 */
test.beforeEach(async ({ homePage, mockAmtrakApi }) => {
  if (await homePage.findTrainsForm.isReady()) {
    return;
  }
  if (mockAmtrakApi) {
    throw new Error(
      'Mocked lane: the "Find trains" widget did not become interactive. This is not a bot wall — ' +
        'check for selector drift / an app change. See docs/APPROACH.md ➜ "Known risks".',
    );
  }
  test.skip(
    true,
    'Live amtrak.com did not serve an interactive widget (bot protection / network). See docs/APPROACH.md ➜ "Known risks".',
  );
});

export { expect };
