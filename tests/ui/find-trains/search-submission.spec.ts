import { test, expect } from '../../../src/fixtures/pom.fixtures';
import {
  DEPART_LEAD_DAYS,
  STATIONS,
  SUBMITTABLE_TRIP_TYPES,
  TripSearchBuilder,
  addDays,
  isoDate,
  standardTripFor,
  stationCode,
  type TripLeg,
} from '../../../src/data/test-data';
import { readLegs, readTripType } from '../../../src/support/journey-search';

/**
 * The "Find trains" button itself: it stays `aria-disabled` until From, To and a
 * departure date are all set, and a valid submit fires exactly one request —
 * `POST /dotcom/journey-solution-option` (verified by live network capture, 2026-08-28).
 * Per the assignment scope we stop at the click; that request is intercepted and
 * aborted, and nothing about the Select Train page it navigates to is asserted.
 *
 * Every test here is non-mutating UI interaction, so every test is `@smoke`.
 */
test.describe('Find trains form — search submission', () => {
  test('[smoke] Find trains stays disabled until From, To and departure date are set', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'true');

    await homePage.findTrainsForm.selectStation('from', STATIONS.newYork.query);
    await homePage.findTrainsForm.selectStation('to', STATIONS.washington.query);
    await homePage.findTrainsForm.selectDepartureDate(addDays(new Date(), DEPART_LEAD_DAYS));

    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'false');
  });

  test('[smoke] Find trains stays disabled when only From is set', { tag: '@smoke' }, async ({ homePage }) => {
    await homePage.findTrainsForm.selectStation('from', STATIONS.newYork.query);

    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'true');
  });

  test('[smoke] a fully completed one-way search is valid — no error, submit enabled', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    const trip = TripSearchBuilder.aTrip()
      .oneWay()
      .from(STATIONS.newYork.query)
      .to(STATIONS.washington.query)
      .departingInDays(DEPART_LEAD_DAYS)
      .build();

    await homePage.findTrainsForm.fillSearch(trip);

    // Assert on the *form*, not on what the click's backend call returns (which varies).
    // SS4–SS6 cover the click and the request it fires.
    await expect(homePage.findTrainsForm.anyValidationError()).toHaveCount(0);
    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'false');
  });

  // One assertion path, run per bookable trip type (see SUBMITTABLE_TRIP_TYPES).
  for (const { tripType, apiType } of SUBMITTABLE_TRIP_TYPES) {
    test(`[smoke] a ${tripType} submit sends the entered trip to the search API`, { tag: '@smoke' }, async ({
      homePage,
      page,
    }) => {
      const trip = standardTripFor(tripType);
      // The legs the request should carry: explicit legs for multi-city; outbound +
      // reversed return for round-trip; a single leg for one-way.
      const expectedLegs: TripLeg[] =
        trip.legs ??
        (trip.returnDate
          ? [
              { from: trip.from, to: trip.to, departDate: trip.departDate },
              { from: trip.to, to: trip.from, departDate: trip.returnDate },
            ]
          : [{ from: trip.from, to: trip.to, departDate: trip.departDate }]);

      // Intercept the one API the widget calls on submit (verified 2026-08-28:
      // POST /dotcom/journey-solution-option). Abort it — the Select Train page the
      // click navigates to, and Amtrak's search backend, are out of scope. We assert
      // only that the request left carrying what the user entered.
      let searchBody: unknown;
      await page.route(homePage.findTrainsForm.journeySearchRoute, async (route) => {
        searchBody ??= route.request().postDataJSON();
        await route.abort();
      });

      await homePage.findTrainsForm.fillSearch(trip);
      await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'false');
      await homePage.findTrainsForm.findTrainsButton().click();

      await expect
        .poll(() => searchBody, {
          message: `no journey-solution-option request was sent after the ${tripType} submit`,
        })
        .toBeTruthy();

      expect(readTripType(searchBody)).toBe(apiType);

      const legs = readLegs(searchBody);
      expect(legs).toHaveLength(expectedLegs.length);

      expectedLegs.forEach((expected, i) => {
        expect(legs[i].destinationCode).toBe(stationCode(expected.to));
        expect(legs[i].departDateTime).toContain(isoDate(expected.departDate));
        expect(legs[i].passengerCount).toBe(1); // mirrors the form default of 1 adult

        if (i === 0) {
          expect(legs[i].originCode).toBe(stationCode(expected.from));
        } else {
          // Live-widget quirk (captured 2026-08-28): legs after the first can echo the
          // origin as a display name ("Boston") instead of the code ("BOS"). Accept both.
          const code = stationCode(expected.from);
          const city = expected.from.split(',')[0];
          expect(legs[i].originCode).toMatch(new RegExp(`^(${code}|${city})`, 'i'));
        }
      });
    });
  }
});
