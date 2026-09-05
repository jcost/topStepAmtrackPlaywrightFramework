import { test, expect } from '../../../src/fixtures/pom.fixtures';

/**
 * The trip-type toggle and how it reshapes the form. This file covers the Multi-City
 * reshape; the Round-Trip reshape is already driven end to end by the round-trip submit
 * test, so it isn't repeated here. Non-mutating UI interaction — `@smoke`.
 */
test.describe('Find trains form — trip type', () => {
  test('Choosing Multi-City turns the form into a multi-leg builder', { tag: '@smoke' }, async ({
    homePage,
    page,
  }) => {
    await homePage.findTrainsForm.selectTripType('multi-city');
    await expect(homePage.findTrainsForm.tripTypeButton()).toContainText('Multi-City');
    await expect(homePage.findTrainsForm.addTripButton()).toBeVisible();
    await expect(homePage.findTrainsForm.removeTripButton()).toBeVisible();
    await expect(homePage.findTrainsForm.returnDateInput()).toBeHidden(); // each leg is one-way

    page.locator('button');
    page.locator('input');
  });
});
