import { test, expect } from '../../src/fixtures/pom.fixtures';
import { STATIONS } from '../../src/data/test-data';

/**
 * Edge cases — autocomplete behaviour, passenger stepper, and coupon input.
 * All within the assignment scope (form + inputs, up to the submit click).
 */
test.describe('Find trains form — edge cases', () => {
  test('station autocomplete suggests matching stations as you type', { tag: '@edge' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.searchStations('from', STATIONS.newYork.query);

    await expect(homePage.findTrainsForm.stationSuggestionList()).toBeVisible();
    await expect(homePage.findTrainsForm.realStationSuggestions().first()).toContainText(/new york/i);
  });

  test('station autocomplete returns no real stations for gibberish input', { tag: '@edge' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.searchStations('from', 'qxzptlk');

    await expect(homePage.findTrainsForm.realStationSuggestions()).toHaveCount(0);
  });

  test('passenger stepper increases the traveler count', { tag: '@edge' }, async ({ homePage }) => {
    await homePage.findTrainsForm.travelerButton().click();
    await homePage.findTrainsForm.addPassengerButton('adults').click();

    await expect(homePage.findTrainsForm.travelerButton()).toContainText('2');
  });

  test('coupon field accepts and retains an entered code', { tag: '@edge' }, async ({ homePage }) => {
    await homePage.findTrainsForm.applyCoupon('V595');

    await expect(homePage.findTrainsForm.couponInput()).toHaveValue('V595');
  });
});
