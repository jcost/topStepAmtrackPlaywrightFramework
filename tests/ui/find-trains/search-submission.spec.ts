import { test, expect } from '../../../src/fixtures/pom.fixtures';
import {
  DEPART_LEAD_DAYS,
  STATIONS,
  SUBMITTABLE_TRIP_TYPES,
  TripSearchBuilder,
  addDays,
  expectedLegsFor,
  isoDate,
  standardTripFor,
  stationCode,
} from '../../../src/data/test-data';
import { readLegs, readTripType } from '../../../src/support/journey-search';

/**
 * The "Find trains" button itself: it stays `aria-disabled` until From, To and a
 * departure date are all set, and a valid submit fires exactly one request —
 * `POST /dotcom/journey-solution-option`. Per the assignment scope we stop at the click;
 * that request is intercepted and aborted, and nothing about the Select Train page it
 * navigates to is asserted.
 *
 * Every test here is non-mutating UI interaction, so every test is `@smoke`.
 */
test.describe('Find trains form — search submission', () => {
  test('Find trains stays disabled until From, To and departure date are set', { tag: '@smoke' }, async ({
    homePage,
  }) => {
    // Disabled on the empty form, and still disabled after each field until all three are set.
    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'true');

    await homePage.findTrainsForm.selectStation('from', STATIONS.newYork.query);
    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'true');

    await homePage.findTrainsForm.selectStation('to', STATIONS.washington.query);
    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'true');

    await homePage.findTrainsForm.selectDepartureDate(addDays(new Date(), DEPART_LEAD_DAYS));
    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'false');
  });

  // One assertion path, run per bookable trip type (see SUBMITTABLE_TRIP_TYPES).
  for (const { tripType, apiType } of SUBMITTABLE_TRIP_TYPES) {
    test(`A ${tripType} submit sends the entered trip to the search API`, { tag: '@smoke' }, async ({
      homePage,
      page,
    }) => {
      const trip = standardTripFor(tripType);
      // The legs the request should carry (OW: 1; RT: outbound + reversed return; MC: the
      // itinerary) — see `expectedLegsFor`.
      const expectedLegs = expectedLegsFor(trip);

      // Intercept the one API the widget calls on submit (POST /dotcom/journey-solution-option)
      // and abort it — the Select Train page the click navigates to, and Amtrak's search
      // backend, are out of scope. We assert only that the request left carrying what the
      // user entered.
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

      expectedLegs.forEach((expectedLeg, legIndex) => {
        const actualLeg = legs[legIndex];
        expect(actualLeg.destinationCode).toBe(stationCode(expectedLeg.to));
        expect(actualLeg.departDateTime).toContain(isoDate(expectedLeg.departDate));
        expect(actualLeg.passengerCount).toBe(1); // mirrors the form default of 1 adult

        if (legIndex === 0) {
          expect(actualLeg.originCode).toBe(stationCode(expectedLeg.from));
        } else {
          // Live-widget quirk: legs after the first can echo the origin as a display name
          // ("Boston") instead of the code ("BOS"). Accept either.
          const expectedOriginCode = stationCode(expectedLeg.from);
          const expectedOriginCity = expectedLeg.from.split(',')[0];
          expect(actualLeg.originCode).toMatch(new RegExp(`^(${expectedOriginCode}|${expectedOriginCity})`, 'i'));
        }
      });
    });
  }

  test('The entered passenger mix is carried into the search request', { tag: '@smoke' }, async ({
    homePage,
    page,
  }) => {
    const trip = TripSearchBuilder.aTrip()
      .oneWay()
      .from(STATIONS.newYork.query)
      .to(STATIONS.washington.query)
      .departingInDays(DEPART_LEAD_DAYS)
      .withPassengers({ adults: 2, children: 1 })
      .build();

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
        message: 'no journey-solution-option request was sent after the passenger-mix submit',
      })
      .toBeTruthy();

    const [leg] = readLegs(searchBody);
    // 2 adults + 1 child → one passenger entry per traveler.
    expect(leg.passengerCount).toBe(3);
    expect([...leg.passengerTypes].sort()).toEqual(['adult', 'adult', 'child']);
  });
});
