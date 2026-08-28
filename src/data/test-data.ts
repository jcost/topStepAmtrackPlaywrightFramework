/**
 * Test data + a small Builder for describing a "Find trains" search.
 *
 * The PDF explicitly calls out the Builder pattern; `TripSearchBuilder` keeps specs
 * readable ("a one-way trip from New York to Washington leaving in 14 days") and gives
 * us one place to evolve defaults as the form changes.
 */

export type TripType = 'round-trip' | 'one-way' | 'multi-city';

export type PassengerType = 'adults' | 'seniors' | 'youth' | 'children' | 'infants';

export type PassengerCounts = Record<PassengerType, number>;

export interface TripSearch {
  tripType: TripType;
  from: string;
  to: string;
  departDate: Date;
  returnDate?: Date;
  passengers: PassengerCounts;
  promoCode?: string;
}

/**
 * A handful of well-known Amtrak stations. `query` is what we type into the
 * autocomplete; `option` matches the suggestion we expect to pick.
 * VERIFY: confirm the option label text against the live autocomplete.
 */
export const STATIONS = {
  newYork: { code: 'NYP', query: 'New York', option: /new york/i },
  washington: { code: 'WAS', query: 'Washington', option: /washington/i },
  boston: { code: 'BOS', query: 'Boston', option: /boston/i },
  philadelphia: { code: 'PHL', query: 'Philadelphia', option: /philadelphia/i },
  chicago: { code: 'CHI', query: 'Chicago', option: /chicago/i },
} as const;

/** Default passenger mix the Amtrak form starts with. VERIFY on the live form. */
export const DEFAULT_PASSENGERS: PassengerCounts = {
  adults: 1,
  seniors: 0,
  youth: 0,
  children: 0,
  infants: 0,
};

export const addDays = (base: Date, days: number): Date => {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
};

export class TripSearchBuilder {
  private trip: TripSearch;

  private constructor() {
    this.trip = {
      tripType: 'one-way',
      from: STATIONS.newYork.query,
      to: STATIONS.washington.query,
      departDate: addDays(new Date(), 14),
      passengers: { ...DEFAULT_PASSENGERS },
    };
  }

  static aTrip = (): TripSearchBuilder => new TripSearchBuilder();

  oneWay = (): TripSearchBuilder => {
    this.trip.tripType = 'one-way';
    this.trip.returnDate = undefined;
    return this;
  };

  roundTrip = (returnInDays = 21): TripSearchBuilder => {
    this.trip.tripType = 'round-trip';
    this.trip.returnDate = addDays(new Date(), returnInDays);
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

  returningInDays = (days: number): TripSearchBuilder => {
    this.trip.returnDate = addDays(new Date(), days);
    return this;
  };

  withPassengers = (counts: Partial<PassengerCounts>): TripSearchBuilder => {
    this.trip.passengers = { ...this.trip.passengers, ...counts };
    return this;
  };

  withPromoCode = (code: string): TripSearchBuilder => {
    this.trip.promoCode = code;
    return this;
  };

  build = (): TripSearch => ({
    ...this.trip,
    passengers: { ...this.trip.passengers },
  });
}
