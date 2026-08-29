import type { Locator, Page } from '@playwright/test';

import {
  stationCode,
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
 * Locator strategy (project standard): `getByRole` -> `getByLabel` -> `.locator` -> css.
 * Where Amtrak ships purpose-built `amt-auto-test-id` attributes we prefer those over a
 * brittle css path — they are the most stable hook the app exposes for automation.
 *
 * Selectors here were derived by inspecting https://www.amtrak.com/home with Playwright
 * on 2026-08-27. Lines that depend on incidental DOM detail are marked `VERIFY:` — re-run
 * `npm run codegen` if Amtrak reworks the widget. See docs/FRAMEWORK.md ➜ "Locator strategy".
 *
 * Contract: arrow-function locators, multi-step "journey" methods allowed, **no assertions**.
 */
export class FindTrainsForm extends BaseComponent {
  /**
   * The single API call the widget fires when a valid form is submitted — a
   * `POST /dotcom/journey-solution-option` (verified by live network capture,
   * 2026-08-28). Specs `page.route(...)` this glob to prove the search was kicked off.
   * The click also navigates to `/tickets/departure.html`, which is out of scope.
   */
  readonly journeySearchRoute = JOURNEY_SEARCH_ROUTE;

  constructor(page: Page) {
    super(page);
  }

  // ---------------------------------------------------------------------------
  // Container / readiness
  // ---------------------------------------------------------------------------

  root = (): Locator => this.page.locator('[amt-auto-test-id="fare-finder-cmp"]');

  findTrainsButton = (): Locator =>
    this.page
      .getByRole('button', { name: 'FIND TRAINS', exact: true })
      .or(this.page.locator('[amt-auto-test-id="fare-finder-findtrains-button"]'))
      .filter({ visible: true })
      .first();

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
    return submit || from;
  };

  // ---------------------------------------------------------------------------
  // Trip type
  // ---------------------------------------------------------------------------

  tripTypeButton = (): Locator =>
    this.page
      .locator('[amt-auto-test-id="fare-finder-travel-selection"]')
      .filter({ visible: true })
      .first();

  tripTypeOption = (label: string): Locator =>
    this.page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).first();

  /** Multi-City only: the controls that add / drop a trip leg. */
  addTripButton = (): Locator =>
    this.page.getByRole('button', { name: 'Add Trip', exact: true }).filter({ visible: true }).first();

  removeTripButton = (): Locator =>
    this.page.getByRole('button', { name: 'Remove Trip', exact: true }).filter({ visible: true }).first();

  // ---------------------------------------------------------------------------
  // Stations (From / To) + autocomplete
  // ---------------------------------------------------------------------------

  // VERIFY: `am-form-field-control-{n}` ids are assigned by Angular in render order.
  // Stable for the current booking widget; fall back to codegen if they shift.
  fromStationInput = (): Locator => this.page.locator('input#am-form-field-control-0');
  toStationInput = (): Locator => this.page.locator('input#am-form-field-control-2');

  // Multi-City renders one `.farefinder-base` row per leg, each with its own
  // `.from-station` / `.to-station` inputs and a `.departed-picker` date field.
  tripLegRows = (): Locator => this.root().locator('.farefinder-base');
  legFromInput = (index: number): Locator =>
    this.tripLegRows().nth(index).locator('.from-station input');
  legToInput = (index: number): Locator => this.tripLegRows().nth(index).locator('.to-station input');
  legDepartDateInput = (index: number): Locator =>
    this.tripLegRows().nth(index).locator('input.departed-picker').first();

  swapStationsButton = (): Locator =>
    this.page.getByRole('button', { name: /switch departure and arrival stations/i }).first();

  stationSuggestionList = (): Locator => this.page.getByRole('listbox').first();

  /** Suggestions that look like a real station, i.e. carry a 3-letter code such as "(NYP)". */
  realStationSuggestions = (): Locator =>
    this.page.getByRole('option').filter({ hasText: /\([A-Z]{3}\)/ });

  // ---------------------------------------------------------------------------
  // Dates (ng-bootstrap datepicker)
  // ---------------------------------------------------------------------------

  // The widget renders different depart inputs for one-way vs round-trip; both are
  // addressed by their `aria-labelledby` (Amtrak's `amt-auto-test-id` is duplicated here).
  departDateInput = (): Locator =>
    this.page
      .locator('input[aria-labelledby="ff-depart-ow-label"], input[aria-labelledby="ff-rt-depart-label"]')
      .filter({ visible: true })
      .first();

  // Only ever one return field in the DOM; no visibility filter so it can still be
  // force-clicked if a just-closed overlay is mid-animation.
  returnDateInput = (): Locator => this.page.locator('input[aria-labelledby="ff-rt-return-label"]').first();

  calendar = (): Locator => this.page.locator('.am-datepicker, .calendar-modal').first();

  calendarNextMonthButton = (): Locator =>
    this.page.getByRole('button', { name: 'Next month' }).first();

  calendarPreviousMonthButton = (): Locator =>
    this.page.getByRole('button', { name: 'Previous month' }).first();

  /** A day cell, addressed by ng-bootstrap's accessible label, e.g. "Thursday, September 10, 2026". */
  calendarDay = (date: Date): Locator =>
    this.page.getByRole('gridcell', { name: formatDayLabel(date) }).first();

  // ---------------------------------------------------------------------------
  // Passengers
  // ---------------------------------------------------------------------------

  travelerButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="traveler-dropdown-button"]').filter({ visible: true }).first();

  addPassengerButton = (type: PassengerType): Locator =>
    this.page.getByRole('button', { name: `+ Add ${SINGULAR[type]}`, exact: true });

  removePassengerButton = (type: PassengerType): Locator =>
    this.page.getByRole('button', { name: `- Remove ${SINGULAR[type]}`, exact: true });

  /** "Reset" in the Travelers popover — also the marker that the popover is open. */
  resetTravelersButton = (): Locator =>
    this.page.getByRole('button', { name: 'Reset', exact: true }).filter({ visible: true }).first();

  /** "Done" in the Travelers popover. Only present while the popover is open (the
   *  datepicker has its own "Done", so callers must not have the calendar open too). */
  travelersDoneButton = (): Locator =>
    this.page.getByRole('button', { name: 'Done', exact: true }).filter({ visible: true }).first();

  /** The "you need an adult" message shown when a child/youth is added with 0 adults. */
  passengerRequirementError = (): Locator =>
    this.page.getByText(/add at least one adult/i).first();

  /** Per-traveler discount / passenger-type combobox, e.g. "Traveler 1: Adult". */
  travelerDiscountSelect = (traveler = 1): Locator =>
    this.page
      .getByRole('combobox', { name: new RegExp(`Traveler ${traveler}:`, 'i') })
      .filter({ visible: true })
      .first();

  /** Options of the open discount combobox — scoped by a distinctive label so the
   *  station autocomplete listboxes can't match. */
  travelerDiscountOptions = (): Locator =>
    this.page
      .getByRole('listbox')
      .filter({ hasText: 'Rail Passengers Association' })
      .getByRole('option');

  // ---------------------------------------------------------------------------
  // Coupon / promo code
  // ---------------------------------------------------------------------------

  couponToggle = (): Locator =>
    this.page
      .getByRole('button', { name: /add coupon/i })
      .or(this.page.locator('[amt-auto-test-id="fare-finder-coupondropdown-button"]'))
      .filter({ visible: true })
      .first();

  couponInput = (): Locator => this.page.locator('[amt-auto-test-id="fare-finder-rewards-coupon"]');

  // ---------------------------------------------------------------------------
  // Errors (read-only locators — assertions happen in the spec)
  // ---------------------------------------------------------------------------

  /** Any non-empty inline validation message inside the widget. */
  anyValidationError = (): Locator =>
    this.root().locator('mat-error, .mat-error, [role="alert"]').filter({ hasText: /\S/ });

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

  /** Type into a station field and leave the suggestion list open (autocomplete tests). */
  searchStations = async (field: 'from' | 'to', query: string): Promise<void> => {
    const input = field === 'from' ? this.fromStationInput() : this.toStationInput();
    await input.click();
    await input.fill('');
    await input.pressSequentially(query, { delay: 60 });
    await this.stationSuggestionList().waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
  };

  /** Type into a station field and pick the first real suggestion that matches the query. */
  selectStation = async (field: 'from' | 'to', query: string): Promise<void> => {
    await this.selectStationInto(field === 'from' ? this.fromStationInput() : this.toStationInput(), query);
  };

  /** Multi-City: pick a station in leg `index` (0-based). */
  selectLegStation = async (index: number, field: 'from' | 'to', query: string): Promise<void> => {
    await this.selectStationInto(field === 'from' ? this.legFromInput(index) : this.legToInput(index), query);
  };

  /** Multi-City: pick leg `index`'s departure date. */
  selectLegDepartureDate = async (index: number, date: Date): Promise<void> => {
    await this.pickDate(this.legDepartDateInput(index), date);
  };

  private selectStationInto = async (input: Locator, query: string): Promise<void> => {
    // When the query is a known catalog station we target its option by 3-letter code
    // and verify the committed value against that code — picking "the first plausible
    // option" occasionally lands on the wrong station on the slower engines.
    const code = stationCode(query);
    const committed = (value: string): boolean =>
      code ? value === code || value.includes(`(${code})`) : /^[A-Z]{3}$/.test(value) || /\([A-Z]{3}\)/.test(value);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await input.click();
      await input.fill('');
      await input.pressSequentially(query, { delay: 60 });

      const match = code
        ? this.page.getByRole('option').filter({ hasText: new RegExp(`\\(${code}\\)`) }).first()
        : this.page
            .getByRole('option', { name: new RegExp(escapeRegExp(query), 'i') })
            .filter({ hasText: /\([A-Z]{3}\)/ })
            .first();
      const appeared = await match
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false);

      if (appeared) {
        await match.click();
      } else {
        await input.press('Enter');
      }

      // A clean pick settles to the code ("NYP") or a label carrying "(NYP)". A value
      // with stray lowercase ("NYPashington", "WASon") means keystrokes landed after
      // the option click — clear it and retry.
      let mangled = false;
      for (let poll = 0; poll < 14; poll += 1) {
        const value = ((await input.inputValue().catch(() => '')) ?? '').trim();
        if (committed(value)) {
          return;
        }
        if (poll >= 4 && /[a-z]/.test(value)) {
          mangled = true;
          break;
        }
        await this.page.waitForTimeout(150);
      }

      if (mangled) {
        await input.fill('').catch(() => undefined);
        await this.page.keyboard.press('Escape').catch(() => undefined);
      }
    }

    // Fail loudly here rather than letting fillSearch continue and the test fail
    // downstream with a mystery "FIND TRAINS still disabled".
    throw new Error(`Could not commit station "${query}" after 4 attempts`);
  };

  selectDepartureDate = async (date: Date): Promise<void> => {
    await this.pickDate(this.departDateInput(), date);
  };

  /** Read-only helper for the "no past dates" test — returns a boolean, never asserts. */
  isDateSelectable = async (date: Date): Promise<boolean> => {
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

  /** Open the "Traveler N" discount combobox and wait for its options to render. */
  openTravelerDiscount = async (traveler = 1): Promise<void> => {
    await this.travelerDiscountSelect(traveler).click();
    await this.travelerDiscountOptions().first().waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
  };

  applyCoupon = async (code: string): Promise<void> => {
    if (!(await this.couponInput().isVisible().catch(() => false))) {
      await this.couponToggle().click();
    }
    await this.couponInput().fill(code);
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
  };

  /** Multi-City: fill each leg's From / To / Depart, adding leg rows as needed. */
  fillLegs = async (legs: TripLeg[]): Promise<void> => {
    // Multi-city renders two leg rows by default, but on the mobile viewport the
    // second one can arrive a beat after the trip type is chosen — wait for the DOM
    // to settle so leg 0's fill doesn't land in a row that is about to be re-created.
    const wanted = Math.min(legs.length, 2);
    for (let i = 0; i < 20 && (await this.tripLegRows().count()) < wanted; i += 1) {
      await this.page.waitForTimeout(150);
    }

    for (let i = 0; i < legs.length; i += 1) {
      while ((await this.tripLegRows().count()) <= i) {
        await this.addTripButton().click();
        await this.page.waitForTimeout(300);
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

  /** Make sure no datepicker overlay is left covering the next field. */
  private ensureCalendarClosed = async (): Promise<boolean> => {
    for (let i = 0; i < 5; i += 1) {
      if (!(await this.calendar().isVisible().catch(() => false))) {
        return true;
      }
      await this.page.keyboard.press('Escape').catch(() => undefined);
      await this.root().click({ position: { x: 5, y: 5 }, force: true }).catch(() => undefined);
      await this.page.waitForTimeout(200);
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
      await this.page.waitForTimeout(150);
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

const SINGULAR: Record<PassengerType, string> = {
  adults: 'adult',
  seniors: 'senior',
  youth: 'youth',
  children: 'child',
  infants: 'infant',
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "Thursday, September 10, 2026" — matches ng-bootstrap's day aria-label. */
const formatDayLabel = (date: Date): string =>
  date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const stripTime = (date: Date): number => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
