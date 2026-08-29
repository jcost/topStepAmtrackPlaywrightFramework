import { test, expect } from '../../../src/fixtures/pom.fixtures';
import { DEPART_LEAD_DAYS, STATIONS, addDays } from '../../../src/data/test-data';

/**
 * From / To station inputs: the autocomplete, the swap control, and the
 * same-origin-and-destination rule. All non-mutating UI interaction — `@smoke`.
 */
test.describe('Find trains form — station selection', () => {
  test('[smoke] autocomplete lists matching stations while the user types', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.searchStations('from', STATIONS.newYork.query);

    await expect(homePage.findTrainsForm.stationSuggestionList()).toBeVisible();
    await expect(homePage.findTrainsForm.realStationSuggestions().first()).toContainText(/new york/i);
  });

  test('[smoke] autocomplete lists no station for an unrecognized query', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.searchStations('from', 'qxzptlk');

    await expect(homePage.findTrainsForm.realStationSuggestions()).toHaveCount(0);
  });

  test('[smoke] the swap control exchanges the From and To stations', { tag: '@smoke' }, async ({ homePage }) => {
    await homePage.findTrainsForm.selectStation('from', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectStation('to', STATIONS.washington.query);

    // Both fields must be committed to their station codes before the swap reads them —
    // on the slower engines the swap can otherwise fire against an uncommitted field
    // and move an empty value across.
    await expect(homePage.findTrainsForm.fromStationInput()).toHaveValue(STATIONS.newYork.code);
    await expect(homePage.findTrainsForm.toStationInput()).toHaveValue(STATIONS.washington.code);

    await homePage.findTrainsForm.swapStationsButton().click();

    await expect(homePage.findTrainsForm.fromStationInput()).toHaveValue(STATIONS.washington.code);
    await expect(homePage.findTrainsForm.toStationInput()).toHaveValue(STATIONS.newYork.code);
  });

  test('[smoke] the same station in From and To leaves Find trains disabled', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.selectStation('from', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectStation('to', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectDepartureDate(addDays(new Date(), DEPART_LEAD_DAYS));

    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'true');
  });
});
