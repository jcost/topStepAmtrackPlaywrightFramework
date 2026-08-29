import { test, expect } from '../../../src/fixtures/pom.fixtures';
import { DEPART_LEAD_DAYS, STATIONS, addDays } from '../../../src/data/test-data';

/**
 * From / To station inputs: the autocomplete (a positive and a negative case) and the
 * same-origin-and-destination rule. All non-mutating UI interaction — `@smoke`.
 */
test.describe('Find trains form — station selection', () => {
  // ST1 / ST2 test the autocomplete integration itself, so they run against the **real**
  // `getResponseList` even in the mocked projects — a stub here would only prove the stub
  // echoes its fixture. They `test.skip` with a reason if Akamai blocks the run.
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

  // ST3 uses station selection only as a precondition for the same-station rule, so it
  // keeps the mocked autocomplete (deterministic fill) in the mocked projects.
  test('The same station in From and To leaves Find trains disabled', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.selectStation('from', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectStation('to', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectDepartureDate(addDays(new Date(), DEPART_LEAD_DAYS));
    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'true');
  });
});
