import { test, expect } from '../../src/fixtures/pom.fixtures';
import { STATIONS, addDays } from '../../src/data/test-data';

/**
 * Validation — Amtrak gates the search by keeping the **"Find trains" button disabled**
 * (`aria-disabled="true"`) until the form is valid, so these tests assert on that gate
 * rather than on inline error text.
 */
test.describe('Find trains form — validation', () => {
  test('Find trains is disabled until origin, destination and date are all provided', async ({
    homePage,
  }) => {
    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'true');

    await homePage.findTrainsForm.selectStation('from', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectStation('to', STATIONS.washington.query);
    await homePage.findTrainsForm.selectDepartureDate(addDays(new Date(), 14));

    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'false', { timeout: 15_000 });
  });

  test('Find trains stays disabled when only the origin is provided', async ({ homePage }) => {
    await homePage.findTrainsForm.selectStation('from', STATIONS.newYork.query);

    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'true');
  });

  test('selecting the same station for origin and destination keeps search disabled', async ({
    homePage,
  }) => {
    await homePage.findTrainsForm.selectStation('from', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectStation('to', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectDepartureDate(addDays(new Date(), 14));

    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'true');
  });

  test('a past departure date cannot be selected in the calendar', async ({ homePage }) => {
    const yesterday = addDays(new Date(), -1);

    const selectable = await homePage.findTrainsForm.isDateSelectable(yesterday);

    expect(selectable).toBe(false);
  });
});
