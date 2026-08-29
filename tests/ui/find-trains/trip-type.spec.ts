import { test, expect } from '../../../src/fixtures/pom.fixtures';

/**
 * The One-Way / Round-Trip / Multi-City toggle and the way it reshapes the form.
 * Non-mutating UI interaction — `@smoke`.
 */
test.describe('Find trains form — trip type', () => {
  test('[smoke] choosing Round-Trip adds a return date field', { tag: '@smoke' }, async ({ homePage }) => {
    await homePage.findTrainsForm.selectTripType('round-trip');

    await expect(homePage.findTrainsForm.departDateInput()).toBeVisible();
    await expect(homePage.findTrainsForm.returnDateInput()).toBeVisible();
  });

  test('[smoke] choosing Multi-City turns the form into a multi-leg builder', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.selectTripType('multi-city');

    await expect(homePage.findTrainsForm.tripTypeButton()).toContainText('Multi-City');
    await expect(homePage.findTrainsForm.addTripButton()).toBeVisible();
    await expect(homePage.findTrainsForm.removeTripButton()).toBeVisible();
    await expect(homePage.findTrainsForm.returnDateInput()).toBeHidden(); // each leg is one-way
  });
});
