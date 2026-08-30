/**
 * Test data + a small Builder for describing a "Find trains" search — keeps specs readable
 * and puts the defaults in one place to evolve as the form changes.
 */

export type TripType = 'round-trip' | 'one-way' | 'multi-city';
export type PassengerType = 'adults' | 'seniors' | 'youth' | 'children' | 'infants';
export type PassengerCounts = Record<PassengerType, number>;
/** One leg of a Multi-City itinerary. */
export interface TripLeg {
  from: string;
  to: string;
  departDate: Date;
}

export interface TripSearch {
  tripType: TripType;
  from: string;
  to: string;
  departDate: Date;
  returnDate?: Date;
  /** Set only for `tripType: 'multi-city'` — one entry per leg. */
  legs?: TripLeg[];
  /** Party mix. Defaults to 1 adult; override with `TripSearchBuilder.withPassengers(...)`. */
  passengers: PassengerCounts;
}

/**
 * A handful of well-known Amtrak stations. `query` is what we type into the autocomplete;
 * `code` is the 3-letter code the search API echoes back.
 */
export const STATIONS = {
  newYork: { code: 'NYP', query: 'New York' },
  washington: { code: 'WAS', query: 'Washington' },
  boston: { code: 'BOS', query: 'Boston' },
  philadelphia: { code: 'PHL', query: 'Philadelphia' },
} as const;

/** Default passenger mix the Amtrak form starts with. */
export const DEFAULT_PASSENGERS: PassengerCounts = {
  adults: 1,
  seniors: 0,
  youth: 0,
  children: 0,
  infants: 0,
};

/** How far ahead the suite books, in days — tuned in one place so tests never rot. */
export const DEPART_LEAD_DAYS = 14;
export const RETURN_LEAD_DAYS = 21;

export const addDays = (base: Date, days: number): Date => {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
};

/** `YYYY-MM-DD` in local time — matches the date portion the search API echoes back. */
export const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export class TripSearchBuilder {
  private trip: TripSearch;

  private constructor() {
    this.trip = {
      tripType: 'one-way',
      from: STATIONS.newYork.query,
      to: STATIONS.washington.query,
      departDate: addDays(new Date(), DEPART_LEAD_DAYS),
      passengers: { ...DEFAULT_PASSENGERS },
    };
  }

  static aTrip = (): TripSearchBuilder => new TripSearchBuilder();

  oneWay = (): TripSearchBuilder => {
    this.trip.tripType = 'one-way';
    this.trip.returnDate = undefined;
    return this;
  };

  roundTrip = (returnInDays = RETURN_LEAD_DAYS): TripSearchBuilder => {
    this.trip.tripType = 'round-trip';
    this.trip.returnDate = addDays(new Date(), returnInDays);
    return this;
  };

  multiCity = (legs: { from: string; to: string; departInDays: number }[]): TripSearchBuilder => {
    this.trip.tripType = 'multi-city';
    this.trip.returnDate = undefined;
    this.trip.legs = legs.map((leg) => ({
      from: leg.from,
      to: leg.to,
      departDate: addDays(new Date(), leg.departInDays),
    }));
    return this;
  };

  from = (query: string): TripSearchBuilder => {
    this.trip.from = query;
    return this;
  };

  to = (query: string): TripSearchBuilder => {
    this.trip.to = query;
    return this;
  };

  departingInDays = (days: number): TripSearchBuilder => {
    this.trip.departDate = addDays(new Date(), days);
    return this;
  };

  /** Override the party mix, e.g. `.withPassengers({ adults: 2, children: 1 })`. */
  withPassengers = (counts: Partial<PassengerCounts>): TripSearchBuilder => {
    this.trip.passengers = { ...this.trip.passengers, ...counts };
    return this;
  };

  build = (): TripSearch => ({
    ...this.trip,
    passengers: { ...this.trip.passengers },
    legs: this.trip.legs?.map((leg) => ({ ...leg })),
  });
}

/** The 3-letter Amtrak code for a station `query` string (e.g. "New York" -> "NYP"). */
export const stationCode = (query: string): string | undefined =>
  Object.values(STATIONS).find((station) => station.query === query)?.code;

/**
 * Trip types whose "Find trains" submit we exercise all the way to the outgoing request,
 * with the `journeyRequest.type` each one produces. The submit spec loops over this so
 * the assertions aren't duplicated per trip type.
 */
export const SUBMITTABLE_TRIP_TYPES = [
  { tripType: 'one-way', apiType: 'OW' },
  { tripType: 'round-trip', apiType: 'RT' },
  { tripType: 'multi-city', apiType: 'MC' },
] as const satisfies ReadonlyArray<{ tripType: TripType; apiType: string }>;

/**
 * The legs a `journey-solution-option` request should carry for a given trip, in order:
 *  - multi-city  → the itinerary's legs verbatim
 *  - round-trip  → outbound, then the return leg (origin/destination reversed)
 *  - one-way     → a single leg
 * Keeps the OW/RT/MC leg model in one place so the submit spec just compares.
 */
export const expectedLegsFor = (trip: TripSearch): TripLeg[] => {
  if (trip.legs?.length) {
    return trip.legs;
  }
  if (trip.returnDate) {
    return [
      { from: trip.from, to: trip.to, departDate: trip.departDate },
      { from: trip.to, to: trip.from, departDate: trip.returnDate },
    ];
  }
  return [{ from: trip.from, to: trip.to, departDate: trip.departDate }];
};

/** The canonical New-York-anchored trip the submit smoke test uses for each trip type. */
export const standardTripFor = (tripType: TripType): TripSearch => {
  const builder = TripSearchBuilder.aTrip()
    .from(STATIONS.newYork.query)
    .to(STATIONS.washington.query)
    .departingInDays(DEPART_LEAD_DAYS);

  switch (tripType) {
    case 'round-trip':
      return builder.roundTrip(RETURN_LEAD_DAYS).build();
    case 'multi-city':
      return builder
        .multiCity([
          { from: STATIONS.newYork.query, to: STATIONS.washington.query, departInDays: DEPART_LEAD_DAYS },
          { from: STATIONS.boston.query, to: STATIONS.philadelphia.query, departInDays: RETURN_LEAD_DAYS },
        ])
        .build();
    case 'one-way':
    default:
      return builder.oneWay().build();
  }
};
