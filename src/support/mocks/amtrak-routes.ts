import type { Page } from '@playwright/test';
import { LOCATION_RESULT, STATION_CATALOG } from './station-catalog';

/**
 * The deterministic mock lane.
 *
 * The live station autocomplete (`AutoCompleterArcgis/getResponseList`) is the one call
 * on the critical path whose latency, under 4 workers × N browser projects, produces the
 * "a field didn't commit" flakes. Stubbing it makes the whole fill flow deterministic and
 * fast without touching worker count. Everything else the widget needs is client-side
 * (the calendar, the traveler popover) or already intercepted by the spec
 * (`journey-solution-option` is aborted in the submit tests).
 *
 * Enabled per-project via the `mockAmtrakApi` fixture option (see `pom.fixtures.ts`).
 */

const AUTOCOMPLETE = /AutoCompleterArcgis\/getResponseList/;

/** Does this catalog station answer to `term`? Matches name / city / aliases, loosely. */
const stationMatches = (term: string): typeof STATION_CATALOG =>
  STATION_CATALOG.filter((station) => {
    const haystack = `${station.stationName} ${station.city} ${station.stationAliases}`.toLowerCase();
    return haystack.includes(term.toLowerCase());
  });

export const mockAmtrakStationAutocomplete = async (page: Page): Promise<void> => {
  await page.route(AUTOCOMPLETE, async (route) => {
    const term = (new URL(route.request().url()).searchParams.get('searchTerm') ?? '').trim();
    const stations = term ? stationMatches(term) : [];

    // Match the live service: a recognised term returns its station(s) plus a trailing
    // free-text "Locations" row; an unrecognised term returns an empty list (the widget
    // then shows nothing — it does *not* fall back to popular stations).
    const autoCompleteList = stations.length ? [...stations, LOCATION_RESULT(`${term}, USA`)] : [];

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ autoCompleterResponse: { autoCompleteList }, responseCode: 0 }),
    });
  });
};
