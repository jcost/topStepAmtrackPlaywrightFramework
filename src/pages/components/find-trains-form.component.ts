import type { Locator, Page } from '@playwright/test';

import {
  DEFAULT_PASSENGERS,
  stationCode,
  type PassengerCounts,
  type PassengerType,
  type TripLeg,
  type TripSearch,
  type TripType,
} from '../../data/test-data';
import { JOURNEY_SEARCH_ROUTE } from '../../support/journey-search';
import { BaseComponent } from './base.component';

/**
 * Component object for the homepage **"Find trains"** search widget
 * (Amtrak's Angular "fare finder").
 *
 * Locator strategy (project standard, most-stable first):
 *   1. `[amt-auto-test-id="…"]`  — an attribute Amtrak added *for* test automation; when
 *      one exists for the control it is the single most stable hook.
 *   2. `getByRole` (role + accessible name)
 *   3. `getByLabel`
 *   4. a unique, stable `id`  (not currently needed)
 *   5. css  (`aria-labelledby` on the date inputs; class union on the calendar)
 * No `.or(...)` fallback chains — a removed test-id should break the locator loudly here,
 * not fall through to a fragile text match. `.filter({ visible: true })` picks the
 * rendered one of a duplicated set: Amtrak ships the widget twice (desktop + mobile), and
 * Multi-City renders one station field / date input per leg plus a hidden leftover
 * One-Way/Round-Trip copy. The station accessors filter the **container**, not the
 * `<input>` — a committed field collapses its input to a code chip (so `input:visible`
 * matches nothing) while the `<station-search>` stays visible; the field's own
 * autocomplete `listbox` is nested inside that container, so options are scoped there too.
 * `.first()` is used **only** where a locator still resolves to >1 element after that:
 * `findTrainsButton` / `addTripButton` / `removeTripButton` (re-render fade window),
 * `calendar` (union matches wrapper + inner), `passengerRequirementError` (message
 * printed on two nodes).
 *
 * The accessors that fall back past the test-id tier (`departDateInput`, `returnDateInput`
 * on `aria-labelledby`; the calendar container + controls; `tripTypeOption`) each carry a
 * comment saying which test-id exists and why it is unusable (duplicated, mislabeled, or
 * third-party). See docs/FRAMEWORK.md ➜ "Conventions / Locators".
 *
 * Contract: arrow-function locators, multi-step "journey" methods allowed, **no assertions**.
 */
export class FindTrainsForm extends BaseComponent {
  /**
   * The single API call the widget fires when a valid form is submitted — a
   * `POST /dotcom/journey-solution-option`. Specs `page.route(...)` this glob to prove
   * the search was kicked off. The click also navigates to `/tickets/departure.html`,
   * which is out of scope.
   */
  readonly journeySearchRoute = JOURNEY_SEARCH_ROUTE;

  constructor(page: Page) {
    super(page);
  }

  // ---------------------------------------------------------------------------
  // Container / readiness
  // ---------------------------------------------------------------------------

  private root = (): Locator => this.page.locator('[amt-auto-test-id="fare-finder-cmp"]');

  // Two nodes carry this test-id (desktop + mobile copy of the widget); `.filter(visible)`
  // leaves the active one. `.first()` covers the brief window during the trip-type
  // re-render where the outgoing copy is still visible while the new one mounts.
  findTrainsButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="fare-finder-findtrains-button"]').filter({ visible: true }).first();

  /** Wait (not assert) for the widget's core controls to be interactive; swallows
   *  timeouts so the POM fixture can `test.skip()` gracefully when the page is blocked.
   *  Gates on the trip-type selector and a station field too, not just the submit
   *  button — on the mobile viewport the Angular re-render lags and specs would
   *  otherwise start interacting before the widget has settled. */
  waitUntilReady = async (): Promise<void> => {
    await Promise.all(
      [this.findTrainsButton(), this.tripTypeButton(), this.fromStationInput()].map((locator) =>
        locator.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined),
      ),
    );
  };

  isReady = async (): Promise<boolean> => {
    const submit = await this.findTrainsButton().isVisible().catch(() => false);
    const from = await this.fromStationInput().isVisible().catch(() => false);
    return submit && from;
  };

  // ---------------------------------------------------------------------------
  // Trip type
  // ---------------------------------------------------------------------------

  // Single node in the DOM — `.filter(visible)` is enough, no `.first()` needed.
  tripTypeButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="fare-finder-travel-selection"]').filter({ visible: true });

  // The dropdown menu items have no test-id (the `data-julie` buttons that do are a
  // no-accessible-name side channel). One menu item per label — `.filter(visible)` → one.
  tripTypeOption = (label: string): Locator =>
    this.page.getByRole('button', { name: label, exact: true }).filter({ visible: true });

  /** Multi-City only: the controls that add / drop a trip leg. Amtrak's purpose-built
   *  `amt-auto-test-id`. `.first()` covers the trip-type re-render
   *  window when these mount, same as `findTrainsButton`. */
  addTripButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="multi-city-add-trip"]').filter({ visible: true }).first();

  removeTripButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="multi-city-remove-trip"]').filter({ visible: true }).first();

  // ---------------------------------------------------------------------------
  // Stations (From / To) + autocomplete
  // ---------------------------------------------------------------------------

  // Each station field is a `<station-search amt-auto-test-id="fare-finder-{from,to}-station-field-page">`
  // wrapping one `<input>` *and its own autocomplete `listbox`*. Everything about a field
  // — the input, the suggestion list, its options — is scoped to this container so a
  // Multi-City leg (or a just-committed neighbour) can't cross-talk. Anchored under
  // `root()` so a same-named field elsewhere on the page can never match. Filter the
  // container by visibility, not the input: once a station is committed the widget
  // collapses the `<input>` to a code chip (so `input:visible` matches nothing) while the
  // container stays visible. One-Way / Round-Trip show one container of each; Multi-City
  // shows one per leg plus a hidden leftover One-Way/Round-Trip container — so `.nth(index)`
  // addresses a leg (visible-DOM order == leg order; the count is settled by
  // `settledLegCount` before any leg is filled).
  private stationField = (field: 'from' | 'to', index = 0): Locator =>
    this.root()
      .locator(`[amt-auto-test-id="fare-finder-${field}-station-field-page"]`)
      .filter({ visible: true })
      .nth(index);

  fromStationInput = (): Locator => this.stationField('from').locator('input');

  // `fare-finder-depart-date-oneway` is on the OW depart input *and* every Multi-City
  // leg date — unique per leg once filtered to visible.
  legDepartDateInput = (index: number): Locator =>
    this.page.locator('[amt-auto-test-id="fare-finder-depart-date-oneway"]').filter({ visible: true }).nth(index);

  /** The open suggestion list for a station field. Every `<station-search>` has its own
   *  `listbox`; `getByRole` inside the (visible) container ignores the others, which linger
   *  in the DOM holding stale options after their field commits. */
  stationSuggestionList = (field: 'from' | 'to' = 'from', index = 0): Locator =>
    this.stationField(field, index).getByRole('listbox');

  /** Suggestions in a field's open list that look like a real station, i.e. carry a
   *  3-letter code such as "(NYP)" (not a "Locations" / bare city-name row). */
  realStationSuggestions = (field: 'from' | 'to' = 'from', index = 0): Locator =>
    this.stationSuggestionList(field, index).getByRole('option').filter({ hasText: /\([A-Z]{3}\)/ });

  // ---------------------------------------------------------------------------
  // Dates (ng-bootstrap datepicker)
  // ---------------------------------------------------------------------------

  // No usable test-id for the top-level date fields: `fare-finder-depart-date-oneway`
  // covers the OW depart but NOT the RT depart, and `fare-finder-return-date-roundtrip`
  // is on FOUR inputs (RT depart + RT return + two hidden). The per-field
  // `aria-labelledby` label ids (`ff-depart-ow-label` / `ff-rt-depart-label` /
  // `ff-rt-return-label`) are each unique, so they are the stablest hook. `VERIFY:`.
  departDateInput = (): Locator =>
    this.page
      .locator('input[aria-labelledby="ff-depart-ow-label"], input[aria-labelledby="ff-rt-depart-label"]')
      .filter({ visible: true });

  returnDateInput = (): Locator => this.page.locator('input[aria-labelledby="ff-rt-return-label"]');

  // ng-bootstrap datepicker — a third-party lib, so no Amtrak test-ids anywhere in it.
  // `.first()` is load-bearing: the union matches the outer `.calendar-modal` wrapper AND
  // the inner `.am-datepicker`, both visible while open; we want the outer (Escape /
  // outside-click dismissal targets it). The nav has one control (not one per grid).
  calendar = (): Locator => this.page.locator('.calendar-modal, .am-datepicker').first();

  calendarNextMonthButton = (): Locator => this.page.getByRole('button', { name: 'Next month' });

  calendarPreviousMonthButton = (): Locator => this.page.getByRole('button', { name: 'Previous month' });

  /** A day cell, addressed by ng-bootstrap's accessible label, e.g. "Thursday, September 10, 2026". */
  calendarDay = (date: Date): Locator =>
    this.page.getByRole('gridcell', { name: formatDayLabel(date) });

  // ---------------------------------------------------------------------------
  // Passengers
  // ---------------------------------------------------------------------------

  travelerButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="traveler-dropdown-button"]').filter({ visible: true });

  // Steppers: `traveler-component-<key>-incr-button` / `-dcr-button`, where <key> is the
  // widget's own (inconsistent) singular/plural — see `TRAVELER_KEY`.
  addPassengerButton = (type: PassengerType): Locator =>
    this.page.locator(`[amt-auto-test-id="traveler-component-${TRAVELER_KEY[type]}-incr-button"]`).filter({ visible: true });

  removePassengerButton = (type: PassengerType): Locator =>
    this.page.locator(`[amt-auto-test-id="traveler-component-${TRAVELER_KEY[type]}-dcr-button"]`).filter({ visible: true });

  /** "Reset" in the Travelers popover — also the marker that the popover is open. */
  resetTravelersButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="traveler-clear"]').filter({ visible: true });

  /** "Done" in the Travelers popover. Its own test-id — no collision with the
   *  datepicker's "Done", so no `.first()` needed. */
  travelersDoneButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="traveler-component-discount-done-button"]').filter({ visible: true });

  /** The "you need an adult" message shown when a child/youth is added with 0 adults.
   *  No test-id; printed on two nodes (an `[role=alert]` and a `<p>`), so `.first()`. */
  passengerRequirementError = (): Locator =>
    this.page.getByText(/add at least one adult/i).first();

  // ---------------------------------------------------------------------------
  // Multi-step journeys (the "login-style" flows the standard allows here)
  // ---------------------------------------------------------------------------

  selectTripType = async (tripType: TripType): Promise<void> => {
    const label = TRIP_TYPE_LABEL[tripType];
    await this.tripTypeButton().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
    const current = (await this.tripTypeButton().getAttribute('aria-label').catch(() => '')) ?? '';
    if (!current.toLowerCase().includes(label.toLowerCase())) {
      await this.tripTypeButton().click();
      await this.tripTypeOption(label).click();
    }

    // Let the widget re-render for the chosen trip type before anything is filled.
    if (tripType === 'round-trip') {
      await this.returnDateInput().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    } else if (tripType === 'multi-city') {
      await this.addTripButton().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    }
    await this.findTrainsButton().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  };

  /** Type `query` into a station field. `fill` places all but the last character
   *  atomically (nothing to leak into another field), then one real keystroke fires the
   *  keyup the autocomplete listens on. */
  private typeStation = async (input: Locator, query: string): Promise<void> => {
    await input.click();
    await input.fill(query.slice(0, -1));
    await input.pressSequentially(query.slice(-1), { delay: 60 });
  };

  /** Type into a station field and leave the suggestion list open (autocomplete tests). */
  searchStations = async (field: 'from' | 'to', query: string): Promise<void> => {
    await this.typeStation(this.stationField(field).locator('input'), query);
    await this.stationSuggestionList(field).waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
  };

  /** Type into a station field and pick the first real suggestion that matches the query. */
  selectStation = async (field: 'from' | 'to', query: string): Promise<void> => {
    await this.selectStationInto(this.stationField(field), query);
  };

  /** Multi-City: pick a station in leg `index` (0-based). */
  private selectLegStation = async (index: number, field: 'from' | 'to', query: string): Promise<void> => {
    await this.selectStationInto(this.stationField(field, index), query);
  };

  /** Multi-City: pick leg `index`'s departure date. */
  private selectLegDepartureDate = async (index: number, date: Date): Promise<void> => {
    await this.pickDate(this.legDepartDateInput(index), date);
  };

  /** Fill one station `<station-search>` and commit a real station from its own list.
   *  `field` is the container locator (see `stationField`); the input and the option list
   *  are both resolved *inside* it so a neighbouring field's stale list is never touched. */
  private selectStationInto = async (field: Locator, query: string): Promise<void> => {
    const input = field.locator('input');
    // Every caller passes a known catalog station; we target its option by 3-letter code
    // and verify the committed value against that code — picking "the first plausible
    // option" occasionally lands on the wrong station on the slower engines.
    const code = stationCode(query);
    if (!code) {
      throw new Error(`selectStationInto: "${query}" is not a known station — add it to STATIONS in test-data.ts`);
    }
    const committed = (value: string): boolean => value === code || value.includes(`(${code})`);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      // `fill` (see `typeStation`) sets the text atomically so nothing can leak into a
      // previously-committed field if focus shifts mid-interaction ("NYPington").
      await this.typeStation(input, query);

      // The trailing keystroke fires one more autocomplete response; wait for the input to
      // re-settle (any element-swapping re-render done) before reacting to the list. A
      // dropped keystroke just means the option below won't match and the outer loop
      // re-types — no fixed sleep needed.
      await input.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);

      // Option scoped to this field's own list (see `stationField`), matched by code.
      const match = field.getByRole('option').filter({ hasText: new RegExp(`\\(${code}\\)`) }).first();
      const appeared = await match
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false);

      if (appeared) {
        // The list can rebuild between "visible" and "clicked" (a trailing autocomplete
        // response), detaching the option mid-click. Retry the click — re-waiting for the
        // option to be visible between tries — then fall back to keyboard selection, which
        // is immune to the element detaching.
        let picked = false;
        for (let c = 0; c < 4 && !picked; c += 1) {
          picked = await match.click({ timeout: 3_000 }).then(() => true).catch(() => false);
          if (!picked) {
            await match.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined);
          }
        }
        if (!picked) {
          await input.press('ArrowDown').catch(() => undefined);
          await input.press('Enter').catch(() => undefined);
        }
      } else {
        await input.press('Enter').catch(() => undefined); // live lane only — the mock always renders the option
      }

      // A clean pick settles the input to the code ("NYP") or a label carrying "(NYP)".
      for (let poll = 0; poll < 20; poll += 1) {
        const value = ((await input.inputValue().catch(() => '')) ?? '').trim();
        if (committed(value)) {
          return;
        }
        await this.page.waitForTimeout(150);
      }

      await input.fill('').catch(() => undefined);
      await this.page.keyboard.press('Escape').catch(() => undefined);
    }

    // Fail loudly here rather than letting fillSearch continue and the test fail
    // downstream with a mystery "FIND TRAINS still disabled".
    throw new Error(`Could not commit station "${query}" after 5 attempts`);
  };

  selectDepartureDate = async (date: Date): Promise<void> => {
    await this.pickDate(this.departDateInput(), date);
  };

  /** Read-only helper for the "no past dates" test — opens the **departure** calendar and
   *  reports whether `date` can be picked. Returns a boolean, never asserts. */
  isDepartureDateSelectable = async (date: Date): Promise<boolean> => {
    await this.departDateInput().click({ force: true });
    if (!(await this.calendar().isVisible({ timeout: 8_000 }).catch(() => false))) {
      return false;
    }
    const reached = await this.walkCalendarToMonth(date);
    const cell = this.calendarDay(date);
    if (!reached || !(await cell.count())) {
      await this.page.keyboard.press('Escape').catch(() => undefined);
      return false;
    }
    const ariaDisabled = await cell.getAttribute('aria-disabled').catch(() => null);
    const className = (await cell.getAttribute('class').catch(() => '')) ?? '';
    await this.page.keyboard.press('Escape').catch(() => undefined);
    return ariaDisabled !== 'true' && !className.includes('disabled');
  };

  /** Open the Travelers popover (no-op if it is already open). */
  openTravelers = async (): Promise<void> => {
    if (await this.resetTravelersButton().isVisible().catch(() => false)) {
      return;
    }
    await this.travelerButton().click();
    await this.resetTravelersButton().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  };

  /** Step one passenger type up (delta > 0) or down (delta < 0). Popover must be open. */
  adjustPassenger = async (type: PassengerType, delta: number): Promise<void> => {
    const button = delta >= 0 ? this.addPassengerButton(type) : this.removePassengerButton(type);
    for (let i = 0; i < Math.abs(delta); i += 1) {
      await button.click();
    }
  };

  /** Click "Reset" in the Travelers popover. Reverts every type to the default (1 adult). */
  resetTravelers = async (): Promise<void> => {
    await this.openTravelers();
    await this.resetTravelersButton().click();
  };

  /** Set the whole party mix, stepping each type from the form default to the target. */
  private setPassengers = async (counts: Partial<PassengerCounts>): Promise<void> => {
    const target: PassengerCounts = { ...DEFAULT_PASSENGERS, ...counts };
    await this.openTravelers();
    for (const type of Object.keys(target) as PassengerType[]) {
      await this.adjustPassenger(type, target[type] - DEFAULT_PASSENGERS[type]);
    }
    await this.page.keyboard.press('Escape');
  };

  /**
   * Fill the whole form from a {@link TripSearch}. This is the multi-field,
   * "login-style" journey the standard permits inside a Page Object.
   *
   * It deliberately **does not** press "Find trains" — that single action stays in the
   * test, right next to the assertion about what the click produced.
   */
  fillSearch = async (trip: TripSearch): Promise<void> => {
    await this.selectTripType(trip.tripType);

    if (trip.tripType === 'multi-city' && trip.legs?.length) {
      await this.fillLegs(trip.legs);
    } else {
      await this.selectStation('from', trip.from);
      await this.selectStation('to', trip.to);
      if (trip.tripType === 'round-trip' && trip.returnDate) {
        // Round-trip uses one range calendar — both dates must be picked in a single
        // open, otherwise closing after the depart click drops the pending range.
        await this.pickDateRange(trip.departDate, trip.returnDate);
      } else {
        await this.selectDepartureDate(trip.departDate);
      }
    }

    if (hasNonDefaultPassengers(trip.passengers)) {
      await this.setPassengers(trip.passengers);
    }
  };

  /** How many leg rows the Multi-City form currently shows (one visible From field each). */
  private legCount = (): Promise<number> =>
    this.page.locator('[amt-auto-test-id="fare-finder-from-station-field-page"]').filter({ visible: true }).count();

  /** Wait for the leg-row count to hold steady — switching to Multi-City re-renders the
   *  whole widget, and a fill that lands mid-re-render loses its keystrokes or spawns a
   *  spurious extra leg. Returns the settled count. */
  private settledLegCount = async (): Promise<number> => {
    let last = -1;
    let steady = 0;
    for (let i = 0; i < 40 && steady < 3; i += 1) {
      const n = await this.legCount();
      steady = n > 0 && n === last ? steady + 1 : 0;
      last = n;
      await this.page.waitForTimeout(150);
    }
    return last;
  };

  /** Multi-City: fill each leg's From / To / Depart, adding leg rows as needed. */
  private fillLegs = async (legs: TripLeg[]): Promise<void> => {
    // Default is two leg rows; only add when the itinerary genuinely has more. `if`, not
    // `while`, and off a *settled* count so a transient re-render dip can't spawn a 3rd row.
    for (let i = 0; i < legs.length; i += 1) {
      if ((await this.settledLegCount()) <= i) {
        await this.addTripButton().click();
        await this.settledLegCount();
      }
      await this.selectLegStation(i, 'from', legs[i].from);
      await this.selectLegStation(i, 'to', legs[i].to);
      await this.selectLegDepartureDate(i, legs[i].departDate);
    }
  };

  // ---------------------------------------------------------------------------
  // Private calendar helpers
  // ---------------------------------------------------------------------------

  private pickDate = async (field: Locator, date: Date): Promise<void> => {
    // Success is signalled by the calendar dismissing itself — the round-trip depart
    // input does not echo its value back as text, so we cannot check `inputValue()`.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await field.click({ force: true });
      const opened = await this.calendar()
        .waitFor({ state: 'visible', timeout: 6_000 })
        .then(() => true)
        .catch(() => false);
      if (!opened) {
        continue;
      }

      await this.walkCalendarToMonth(date);
      const day = this.calendarDay(date);
      if (await day.isVisible().catch(() => false)) {
        await day.click();
      }

      if (await this.ensureCalendarClosed()) {
        return;
      }
    }
    await this.ensureCalendarClosed();
  };

  /** Pick depart + return in a single open of the round-trip range calendar. */
  private pickDateRange = async (departDate: Date, returnDate: Date): Promise<void> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.departDateInput().click({ force: true });
      const opened = await this.calendar()
        .waitFor({ state: 'visible', timeout: 6_000 })
        .then(() => true)
        .catch(() => false);
      if (!opened) {
        continue;
      }

      for (const date of [departDate, returnDate]) {
        await this.walkCalendarToMonth(date);
        const day = this.calendarDay(date);
        if (await day.isVisible().catch(() => false)) {
          await day.click();
        }
      }

      const done = this.page.getByRole('button', { name: 'Done', exact: true }).filter({ visible: true }).first();
      if (await done.isVisible().catch(() => false)) {
        await done.click().catch(() => undefined);
      }

      if (await this.ensureCalendarClosed()) {
        return;
      }
    }
    await this.ensureCalendarClosed();
  };

  /** Make sure no datepicker overlay is left covering the next field. `Escape` is what
   *  actually closes the ng-bootstrap picker (verified live); the click on the page's
   *  `<h1>` is a defensive outside-click for any experiment where it doesn't — a role
   *  target, never a coordinate, so it holds up across viewports. */
  private ensureCalendarClosed = async (): Promise<boolean> => {
    for (let i = 0; i < 5; i += 1) {
      if (!(await this.calendar().isVisible().catch(() => false))) {
        return true;
      }
      await this.page.keyboard.press('Escape').catch(() => undefined);
      await this.page.getByRole('heading', { level: 1 }).first().click().catch(() => undefined);
      await this.calendar().waitFor({ state: 'hidden', timeout: 800 }).catch(() => undefined);
    }
    return !(await this.calendar().isVisible().catch(() => false));
  };

  private walkCalendarToMonth = async (date: Date): Promise<boolean> => {
    const goForward = stripTime(date) >= stripTime(new Date());
    for (let step = 0; step < 18; step += 1) {
      if (await this.calendarDay(date).isVisible().catch(() => false)) {
        return true;
      }
      const navButton = goForward ? this.calendarNextMonthButton() : this.calendarPreviousMonthButton();
      if (await navButton.isDisabled().catch(() => true)) {
        return this.calendarDay(date).isVisible().catch(() => false);
      }
      await navButton.click();
      // Wait for the target day to render rather than sleeping a fixed beat; if this
      // month still doesn't contain it the wait lapses and the loop pages on.
      await this.calendarDay(date).waitFor({ state: 'visible', timeout: 800 }).catch(() => undefined);
    }
    return false;
  };
}

// ---------------------------------------------------------------------------
// Local pure helpers
// ---------------------------------------------------------------------------

const TRIP_TYPE_LABEL: Record<TripType, string> = {
  'round-trip': 'Round-Trip',
  'one-way': 'One-Way',
  'multi-city': 'Multi-City',
};

/** The widget's own key for each traveler type in its stepper test-ids — inconsistently
 *  singular/plural (`adult`, `senior`, `youth`, `child`, `infants`). */
const TRAVELER_KEY: Record<PassengerType, string> = {
  adults: 'adult',
  seniors: 'senior',
  youth: 'youth',
  children: 'child',
  infants: 'infants',
};

/** Matches ng-bootstrap's day aria-label. */
const formatDayLabel = (date: Date): string =>
  date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const stripTime = (date: Date): number => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const hasNonDefaultPassengers = (counts: PassengerCounts): boolean =>
  (Object.keys(counts) as PassengerType[]).some((type) => counts[type] !== DEFAULT_PASSENGERS[type]);
