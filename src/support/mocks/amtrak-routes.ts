import type { Page } from '@playwright/test';
import { LOCATION_RESULT, STATION_CATALOG } from './station-catalog';

/**
 * The deterministic mock lane: stub the one latency-prone call on the fill path — the
 * station autocomplete (`AutoCompleterArcgis/getResponseList`) — so the flow is fast and
 * deterministic. Everything else runs for real. Enabled per-project via the `mockAmtrakApi`
 * fixture option; see docs/FRAMEWORK.md ➜ "The three projects / two lanes".
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
