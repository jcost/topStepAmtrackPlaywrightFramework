/**
 * The one API call a valid submit fires: `POST /dotcom/journey-solution-option`.
 * `journeyRequest.type` is `OW` / `RT` / `MC`; `journeyLegRequests` has one entry per leg
 * — 1 for OW, **2 for RT** (outbound + reversed return), N for MC.
 *
 * Types the asserted parts of that body + a pure reader. No assertions here.
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
    passengerTypes: (leg?.passengers ?? []).map((passenger) => passenger?.initialType ?? '').filter(Boolean),
  }));
};
