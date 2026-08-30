import { test, expect } from '../../../src/fixtures/pom.fixtures';
import { DEPART_LEAD_DAYS, STATIONS, addDays } from '../../../src/data/test-data';

/**
 * From / To station inputs: the autocomplete (a positive and a negative case) and the
 * same-origin-and-destination rule. All non-mutating UI interaction — `@smoke`.
 */
test.describe('Find trains form — station selection', () => {
  // These two test the autocomplete itself, so they hit the real `getResponseList` even in
  // the mocked projects (a stub would just prove the stub echoes its fixture). Skip if blocked.
  test.describe('against the real autocomplete', () => {
    test.use({ mockAmtrakApi: false });

    test('Autocomplete lists matching stations while the user types', { tag: '@smoke' }, async ({
      homePage,
    }) => {
      await homePage.findTrainsForm.searchStations('from', STATIONS.newYork.query);
      await expect(homePage.findTrainsForm.stationSuggestionList()).toBeVisible();
      await expect(homePage.findTrainsForm.realStationSuggestions().first()).toContainText(/new york/i);
    });

    test('Autocomplete lists no station for an unrecognized query', { tag: '@smoke' }, async ({
      homePage,
    }) => {
      await homePage.findTrainsForm.searchStations('from', 'qxzptlk');
      await expect(homePage.findTrainsForm.realStationSuggestions()).toHaveCount(0);
    });
  });

  // This one only uses station selection as a precondition, so it keeps the mocked autocomplete.
  test('The same station in From and To leaves Find trains disabled', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.selectStation('from', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectStation('to', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectDepartureDate(addDays(new Date(), DEPART_LEAD_DAYS));
    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'true');
  });
});
