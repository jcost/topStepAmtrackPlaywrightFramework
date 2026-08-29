import { test, expect } from '../../../src/fixtures/pom.fixtures';

/**
 * The traveler popover: the "you need an adult" safety rule and the Reset control.
 * (The stepper feeding the request is covered by search-submission's passenger-mix
 * test.) All non-mutating UI interaction — `@smoke`.
 */
test.describe('Find trains form — passenger selection', () => {
  test('A child with no adult shows the "add an adult" requirement and blocks Done', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.openTravelers();
    await homePage.findTrainsForm.adjustPassenger('children', 1);
    await homePage.findTrainsForm.adjustPassenger('adults', -1); // 1 -> 0

    await expect(homePage.findTrainsForm.passengerRequirementError()).toBeVisible();
    await expect(homePage.findTrainsForm.passengerRequirementError()).toContainText(/18 years old or older/i);
    await expect(homePage.findTrainsForm.travelersDoneButton()).toBeDisabled();
  });

  test('Reset returns any traveler selection to a single adult', { tag: '@smoke' }, async ({ homePage }) => {
    await homePage.findTrainsForm.openTravelers();
    await homePage.findTrainsForm.adjustPassenger('adults', 1); // -> 2
    await homePage.findTrainsForm.adjustPassenger('children', 2); // -> 2
    await expect(homePage.findTrainsForm.travelerButton()).toContainText('4');

    await homePage.findTrainsForm.resetTravelers();

    // The button's visible text collapses to "1Traveler"; its aria-label keeps the space.
    await expect(homePage.findTrainsForm.travelerButton()).toHaveAttribute('aria-label', /^1 Traveler\b/);
  });
});
