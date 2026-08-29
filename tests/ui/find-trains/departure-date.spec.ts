import { test, expect } from '../../../src/fixtures/pom.fixtures';
import { addDays } from '../../../src/data/test-data';

/**
 * The departure-date calendar and the constraints it enforces on selectable days.
 * Non-mutating UI interaction — `@smoke`.
 */
test.describe('Find trains form — departure date', () => {
  test('Past dates are disabled in the departure calendar', { tag: '@smoke' }, async ({ homePage }) => {
    const yesterday = addDays(new Date(), -1);
    const selectable = await homePage.findTrainsForm.isDepartureDateSelectable(yesterday);
    expect(selectable).toBe(false);
  });
});
