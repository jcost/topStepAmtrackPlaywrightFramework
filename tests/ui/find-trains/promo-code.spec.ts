import { test, expect } from '../../../src/fixtures/pom.fixtures';

/**
 * The optional coupon / promo-code field revealed by "Add Coupon".
 * Non-mutating UI interaction — `@smoke`.
 */
test.describe('Find trains form — promo code', () => {
  test('[smoke] an entered coupon code stays in the field', { tag: '@smoke' }, async ({ homePage }) => {
    await homePage.findTrainsForm.applyCoupon('V595');

    await expect(homePage.findTrainsForm.couponInput()).toHaveValue('V595');
  });
});
