import type { Locator, Page } from '@playwright/test';

import {
  DEFAULT_PASSENGERS,
  type PassengerCounts,
  type PassengerType,
  type TripSearch,
  type TripType,
} from '../../data/test-data';
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
  /** The search request the widget fires when a valid form is submitted. Tests assert on this. */
  readonly searchRequestPattern = /journey-(solution-option|search)|passenger-fares|search\/results/i;

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

  /** Wait (not assert) for the widget to be interactive; swallows timeouts so the POM
   *  fixture can `test.skip()` gracefully when the page is blocked. */
  waitUntilReady = async (): Promise<void> => {
    await this.findTrainsButton()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => undefined);
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

  // ---------------------------------------------------------------------------
  // Stations (From / To) + autocomplete
  // ---------------------------------------------------------------------------

  // VERIFY: `am-form-field-control-{n}` ids are assigned by Angular in render order.
  // Stable for the current booking widget; fall back to codegen if they shift.
  fromStationInput = (): Locator => this.page.locator('input#am-form-field-control-0');
  toStationInput = (): Locator => this.page.locator('input#am-form-field-control-2');

  swapStationsButton = (): Locator =>
    this.page.getByRole('button', { name: /switch departure and arrival stations/i }).first();

  stationSuggestionList = (): Locator => this.page.getByRole('listbox').first();

  stationSuggestionOption = (name: string | RegExp): Locator =>
    this.page.getByRole('option', { name });

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

  errorByText = (text: string | RegExp): Locator =>
    this.root().locator('mat-error, .mat-error, [role="alert"]').filter({ hasText: text }).first();

  // ---------------------------------------------------------------------------
  // Multi-step journeys (the "login-style" flows the standard allows here)
  // ---------------------------------------------------------------------------

  selectTripType = async (tripType: TripType): Promise<void> => {
    const label = TRIP_TYPE_LABEL[tripType];
    const current = (await this.tripTypeButton().getAttribute('aria-label').catch(() => '')) ?? '';
    if (!current.toLowerCase().includes(label.toLowerCase())) {
      await this.tripTypeButton().click();
      await this.tripTypeOption(label).click();
    }

    // Let the widget re-render for the chosen trip type before anything is filled.
    if (tripType === 'round-trip') {
      await this.returnDateInput().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
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
    const input = field === 'from' ? this.fromStationInput() : this.toStationInput();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await input.click();
      await input.fill('');
      await input.pressSequentially(query, { delay: 60 });

      const match = this.page
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

      await this.page.waitForTimeout(400);
      if (((await input.inputValue().catch(() => '')) ?? '').trim() !== '') {
        return;
      }
    }
  };

  selectDepartureDate = async (date: Date): Promise<void> => {
    await this.pickDate(this.departDateInput(), date);
  };

  selectReturnDate = async (date: Date): Promise<void> => {
    await this.pickDate(this.returnDateInput(), date);
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

  setPassengers = async (counts: Partial<PassengerCounts>): Promise<void> => {
    const target: PassengerCounts = { ...DEFAULT_PASSENGERS, ...counts };
    await this.travelerButton().click();

    for (const type of Object.keys(target) as PassengerType[]) {
      const delta = target[type] - DEFAULT_PASSENGERS[type];
      const button = delta >= 0 ? this.addPassengerButton(type) : this.removePassengerButton(type);
      for (let i = 0; i < Math.abs(delta); i += 1) {
        await button.click();
      }
    }

    // Close the panel with Escape — re-clicking the trigger is unreliable once the
    // page has scrolled and the sticky header overlays it.
    await this.page.keyboard.press('Escape');
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
    await this.selectStation('from', trip.from);
    await this.selectStation('to', trip.to);
    await this.selectDepartureDate(trip.departDate);
    if (trip.tripType === 'round-trip' && trip.returnDate) {
      await this.selectReturnDate(trip.returnDate);
    }
    if (hasNonDefaultPassengers(trip.passengers)) {
      await this.setPassengers(trip.passengers);
    }
    if (trip.promoCode) {
      await this.applyCoupon(trip.promoCode);
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

const hasNonDefaultPassengers = (counts: PassengerCounts): boolean =>
  (Object.keys(counts) as PassengerType[]).some((type) => counts[type] !== DEFAULT_PASSENGERS[type]);
