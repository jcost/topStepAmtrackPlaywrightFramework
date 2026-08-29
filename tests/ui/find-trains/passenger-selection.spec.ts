import { test, expect } from '../../../src/fixtures/pom.fixtures';
import type { PassengerType } from '../../../src/data/test-data';

/**
 * The traveler popover: per-type steppers, the "you need an adult" rule, the Reset
 * control, and the per-traveler discount dropdown. All non-mutating UI interaction —
 * `@smoke`.
 */
test.describe('Find trains form — passenger selection', () => {
  test('[smoke] adding an adult increments the traveler count', { tag: '@smoke' }, async ({ homePage }) => {
    await homePage.findTrainsForm.openTravelers();
    await homePage.findTrainsForm.adjustPassenger('adults', 1);

    await expect(homePage.findTrainsForm.travelerButton()).toContainText('2');
  });

  test('[smoke] a child with no adult shows the "add an adult" requirement and blocks Done', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.openTravelers();
    await homePage.findTrainsForm.adjustPassenger('children', 1);
    await homePage.findTrainsForm.adjustPassenger('adults', -1); // 1 -> 0

    await expect(homePage.findTrainsForm.passengerRequirementError()).toBeVisible();
    await expect(homePage.findTrainsForm.passengerRequirementError()).toContainText(/18 years old or older/i);
    await expect(homePage.findTrainsForm.travelersDoneButton()).toBeDisabled();
  });

  const resetCombos: { label: string; counts: Partial<Record<PassengerType, number>> }[] = [
    { label: '2 adults', counts: { adults: 2 } },
    { label: '2 adults and 2 children', counts: { adults: 2, children: 2 } },
  ];

  for (const { label, counts } of resetCombos) {
    test(`[smoke] Reset returns the travelers to a single adult (from ${label})`, { tag: '@smoke' }, async ({
      homePage,
    }) => {
      await homePage.findTrainsForm.openTravelers();
      for (const [type, count] of Object.entries(counts) as [PassengerType, number][]) {
        await homePage.findTrainsForm.adjustPassenger(type, type === 'adults' ? count - 1 : count);
      }
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      await expect(homePage.findTrainsForm.travelerButton()).toContainText(String(total));

      await homePage.findTrainsForm.resetTravelers();

      // The button's visible text collapses to "1Traveler"; its aria-label keeps the space.
      await expect(homePage.findTrainsForm.travelerButton()).toHaveAttribute('aria-label', /^1 Traveler\b/);
      await expect(homePage.findTrainsForm.travelerDiscountSelect(1)).toContainText('Adult');
    });
  }

  test('[smoke] the Traveler 1 discount dropdown offers the four passenger types', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.openTravelers();
    await homePage.findTrainsForm.openTravelerDiscount(1);

    await expect(homePage.findTrainsForm.travelerDiscountOptions()).toHaveText([
      'Adult',
      'Rail Passengers Association',
      'Active US Military',
      'Military Veteran',
    ]);
  });
});
