import { test, expect } from '../../../src/fixtures/pom.fixtures';

/**
 * The trip-type toggle and how it reshapes the form. Round-Trip's reshaping is
 * exercised by the round-trip submit test (it can't fill a return date otherwise);
 * this file covers the Multi-City reshape. Non-mutating UI interaction — `@smoke`.
 */
test.describe('Find trains form — trip type', () => {
  test('Choosing Multi-City turns the form into a multi-leg builder', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.selectTripType('multi-city');
    await expect(homePage.findTrainsForm.tripTypeButton()).toContainText('Multi-City');
    await expect(homePage.findTrainsForm.addTripButton()).toBeVisible();
    await expect(homePage.findTrainsForm.removeTripButton()).toBeVisible();
    await expect(homePage.findTrainsForm.returnDateInput()).toBeHidden(); // each leg is one-way
  });
});
