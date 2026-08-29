/**
 * The "Find trains" widget fires a single API call when a valid search is submitted:
 *
 *   POST https://www.amtrak.com/dotcom/journey-solution-option
 *
 * (Verified against the live site with the Playwright MCP on 2026-08-28. The click also
 * navigates the browser to `/tickets/departure.html`, which is out of scope.)
 *
 * `journeyRequest.type` is `OW` (one-way), `RT` (round-trip) or `MC` (multi-city), and
 * `journeyLegRequests` carries one entry per leg (1 for OW, 1 for RT, N for MC).
 *
 * This module types the parts of that request body the smoke test asserts on, and
 * exposes a pure reader for them. No assertions here — the spec does the `expect`.
 */

/** Glob for `page.route(...)` — the one endpoint that means "the search was kicked off". */
export const JOURNEY_SEARCH_ROUTE = '**/dotcom/journey-solution-option';

/** Shape of the `journey-solution-option` POST body. Only the asserted fields are typed. */
export interface JourneySearchBody {
  journeyRequest?: {
    type?: string; // "OW" (one-way), "RT" (round-trip), ...
    journeyLegRequests?: Array<{
      origin?: { code?: string; schedule?: { departureDateTime?: string } };
      destination?: { code?: string };
      passengers?: Array<{ id?: string; type?: string; initialType?: string }>;
    }>;
  };
}

export interface Leg {
  originCode?: string;
  destinationCode?: string;
  /** e.g. "2026-09-11T00:00:00" */
  departDateTime?: string;
  passengerCount: number;
  /** One entry per traveler, e.g. `["adult", "adult", "child"]`. */
  passengerTypes: string[];
}

/** `journeyRequest.type` — "OW" | "RT" | "MC". Pure. */
export const readTripType = (body: unknown): string | undefined =>
  (body as JourneySearchBody | null | undefined)?.journeyRequest?.type;

/** Every leg of a search request body, in order. Pure. */
export const readLegs = (body: unknown): Leg[] => {
  const legs = (body as JourneySearchBody | null | undefined)?.journeyRequest?.journeyLegRequests ?? [];
  return legs.map((leg) => ({
    originCode: leg?.origin?.code,
    destinationCode: leg?.destination?.code,
    departDateTime: leg?.origin?.schedule?.departureDateTime,
    passengerCount: leg?.passengers?.length ?? 0,
    passengerTypes: (leg?.passengers ?? []).map((p) => p?.initialType ?? '').filter(Boolean),
  }));
};
