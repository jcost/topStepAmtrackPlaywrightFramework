import { test, expect } from '../../src/fixtures/pom.fixtures';
import { STATIONS, TripSearchBuilder } from '../../src/data/test-data';

/**
 * Happy path — a valid search enables "Find trains" and is accepted without a
 * validation error. Per the assignment scope we stop at the button click and do
 * NOT assert anything about the results page.
 */
test.describe('Find trains form — happy path', () => {
  test('accepts a one-way search with valid stations and a future date', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    const trip = TripSearchBuilder.aTrip()
      .oneWay()
      .from(STATIONS.newYork.query)
      .to(STATIONS.washington.query)
      .departingInDays(14)
      .build();

    await homePage.findTrainsForm.fillSearch(trip);

    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'false', { timeout: 15_000 });
    await homePage.findTrainsForm.findTrainsButton().click();
    await expect(homePage.findTrainsForm.anyValidationError()).toHaveCount(0);
  });

  test('switching to round-trip reveals depart and return date fields', async ({ homePage }) => {
    await homePage.findTrainsForm.selectTripType('round-trip');

    await expect(homePage.findTrainsForm.departDateInput()).toBeVisible();
    await expect(homePage.findTrainsForm.returnDateInput()).toBeVisible();
  });

  test('clicking Find trains on a valid search issues the journey-search request', { tag: '@smoke' }, async ({
    homePage,
    page,
  }) => {
    const trip = TripSearchBuilder.aTrip()
      .oneWay()
      .from(STATIONS.newYork.query)
      .to(STATIONS.washington.query)
      .departingInDays(14)
      .build();

    await homePage.findTrainsForm.fillSearch(trip);

    const searchRequest = page.waitForRequest(homePage.findTrainsForm.searchRequestPattern, {
      timeout: 45_000,
    });
    await homePage.findTrainsForm.findTrainsButton().click();
    await searchRequest;
  });

  test('swap button reverses the From and To stations', async ({ homePage }) => {
    await homePage.findTrainsForm.selectStation('from', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectStation('to', STATIONS.washington.query);

    const fromBefore = await homePage.findTrainsForm.fromStationInput().inputValue();
    const toBefore = await homePage.findTrainsForm.toStationInput().inputValue();
    expect(fromBefore).not.toEqual(toBefore);

    await homePage.findTrainsForm.swapStationsButton().click();

    await expect(homePage.findTrainsForm.fromStationInput()).toHaveValue(toBefore);
    await expect(homePage.findTrainsForm.toStationInput()).toHaveValue(fromBefore);
  });
});
