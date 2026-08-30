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
 * Component object for the homepage **"Find trains"** widget (Amtrak's Angular "fare finder").
 *
 * Contract: locators are arrow-function properties, multi-step "journey" methods are
 * allowed, and there are **no assertions** here (lint-enforced).
 *
 * Locators prefer `[amt-auto-test-id]` → `getByRole` → `getByLabel` → id → css, with no
 * `.or(...)` fallbacks. Where an accessor needs a `.filter({ visible: true })`, a
 * `.first()`, or a css fallback, the reason is in a comment right above it.
 * Full rationale: docs/FRAMEWORK.md ➜ "Conventions".
 */
export class FindTrainsForm extends BaseComponent {
  /** The one API call a valid submit fires. Specs `page.route(...)` this to prove the
   *  search was kicked off; the page it also navigates to is out of scope. */
  readonly journeySearchRoute = JOURNEY_SEARCH_ROUTE;

  constructor(page: Page) {
    super(page);
  }

  // ---------------------------------------------------------------------------
  // Container / readiness
  // ---------------------------------------------------------------------------

  private root = (): Locator => this.page.locator('[amt-auto-test-id="fare-finder-cmp"]');

  // test-id ×2 (desktop + mobile); `.filter(visible)` + `.first()` for the re-render window.
  findTrainsButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="fare-finder-findtrains-button"]').filter({ visible: true }).first();

  /** Wait (don't assert) for the core controls to be interactive; swallows timeouts so the
   *  fixture decides whether to skip. Gates on 3 controls — the mobile re-render lags. */
  waitUntilReady = async (): Promise<void> => {
    await Promise.all(
      [this.findTrainsButton(), this.tripTypeButton(), this.fromStationInput()].map((locator) =>
        // 30s — Angular bootstrap can lag under load; a broken selector still fails.
        locator.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined),
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

  // One visible node — `.filter(visible)` is enough, no `.first()` needed.
  tripTypeButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="fare-finder-travel-selection"]').filter({ visible: true });

  // Menu items have no test-id (the `data-julie` ones lack an accessible name). One per label.
  tripTypeOption = (label: string): Locator =>
    this.page.getByRole('button', { name: label, exact: true }).filter({ visible: true });

  /** Multi-City add/drop-leg controls. `.first()` for the re-render window (as `findTrainsButton`). */
  addTripButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="multi-city-add-trip"]').filter({ visible: true }).first();

  removeTripButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="multi-city-remove-trip"]').filter({ visible: true }).first();

  // ---------------------------------------------------------------------------
  // Stations (From / To) + autocomplete
  // ---------------------------------------------------------------------------

  // A `<station-search amt-auto-test-id="fare-finder-{from,to}-station-field-page">` wrapping
  // one `<input>` and its own `listbox` — scoped to this container so legs / a just-committed
  // neighbour can't cross-talk. Filter the *container* by visibility (a committed field
  // collapses its input to a chip); `.nth(index)` picks a Multi-City leg by DOM order.
  private stationField = (field: 'from' | 'to', index = 0): Locator =>
    this.root()
      .locator(`[amt-auto-test-id="fare-finder-${field}-station-field-page"]`)
      .filter({ visible: true })
      .nth(index);

  fromStationInput = (): Locator => this.stationField('from').locator('input');

  // test-id shared by the OW depart input and every leg date — unique once visible-filtered.
  legDepartDateInput = (index: number): Locator =>
    this.page.locator('[amt-auto-test-id="fare-finder-depart-date-oneway"]').filter({ visible: true }).nth(index);

  /** A field's open suggestion list — scoped inside its container so stale sibling lists
   *  (which linger in the DOM after a commit) are ignored. */
  stationSuggestionList = (field: 'from' | 'to' = 'from', index = 0): Locator =>
    this.stationField(field, index).getByRole('listbox');

  /** Suggestions that carry a 3-letter code like "(NYP)" (not a bare "Locations" row). */
  realStationSuggestions = (field: 'from' | 'to' = 'from', index = 0): Locator =>
    this.stationSuggestionList(field, index).getByRole('option').filter({ hasText: /\([A-Z]{3}\)/ });

  // ---------------------------------------------------------------------------
  // Dates (ng-bootstrap datepicker)
  // ---------------------------------------------------------------------------

  // VERIFY: no usable test-id (`fare-finder-return-date-roundtrip` is on 4 inputs and
  // mislabeled); the per-field `aria-labelledby` ids are unique and the stablest hook.
  departDateInput = (): Locator =>
    this.page
      .locator('input[aria-labelledby="ff-depart-ow-label"], input[aria-labelledby="ff-rt-depart-label"]')
      .filter({ visible: true });

  returnDateInput = (): Locator => this.page.locator('input[aria-labelledby="ff-rt-return-label"]');

  // VERIFY: ng-bootstrap (third-party, no test-ids). `.first()` picks the outer
  // `.calendar-modal` wrapper over the inner `.am-datepicker` — dismissal targets the outer.
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

  // Steppers: `traveler-component-<key>-incr/dcr-button` — `<key>` via `TRAVELER_KEY`.
  addPassengerButton = (type: PassengerType): Locator =>
    this.page.locator(`[amt-auto-test-id="traveler-component-${TRAVELER_KEY[type]}-incr-button"]`).filter({ visible: true });

  removePassengerButton = (type: PassengerType): Locator =>
    this.page.locator(`[amt-auto-test-id="traveler-component-${TRAVELER_KEY[type]}-dcr-button"]`).filter({ visible: true });

  /** "Reset" in the Travelers popover — also the marker that the popover is open. */
  resetTravelersButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="traveler-clear"]').filter({ visible: true });

  /** "Done" in the Travelers popover — its own test-id, no calendar-"Done" collision. */
  travelersDoneButton = (): Locator =>
    this.page.locator('[amt-auto-test-id="traveler-component-discount-done-button"]').filter({ visible: true });

  /** The "add an adult" message — no test-id, printed on two nodes, so `.first()`. */
  passengerRequirementError = (): Locator =>
    this.page.getByText(/add at least one adult/i).first();

  // ---------------------------------------------------------------------------
  // Multi-step journeys (the "login-style" flows the standard allows here)
  // ---------------------------------------------------------------------------

  selectTripType = async (tripType: TripType): Promise<void> => {
    const label = TRIP_TYPE_LABEL[tripType];
    await this.tripTypeButton().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
    const currentLabel = (await this.tripTypeButton().getAttribute('aria-label').catch(() => '')) ?? '';
    if (!currentLabel.toLowerCase().includes(label.toLowerCase())) {
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

  /** Type `query` into a station field. The split is deliberate: `fill` the body in one
   *  shot (a synchronous set — no chance of a stray char landing in an already-committed
   *  neighbouring field if focus slips), then press only the last char for real so a
   *  trusted keystroke actually wakes the debounced autocomplete. See `selectStationInto`. */
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

  /**
   * Fill a `<station-search>` and commit a real station from its own list.
   *
   * This is deliberately more elaborate than "`input.fill(query)` → click the first
   * option". Amtrak's From/To field is a debounced Angular autocomplete on a live
   * third-party site, and the naive version flaked ~1 run in 20 — three distinct ways,
   * each guarded below:
   *   1. `fill()` dispatches a *synthetic* (`isTrusted: false`) `input` event that the
   *      widget sometimes ignores, so no search fires and no options render →
   *      corrective re-type with real keystrokes.
   *   2. The option list rebuilds between "visible" and "clicked" (a trailing debounced
   *      response), detaching the element mid-click → click-retry + keyboard fallback.
   *   3. Typing the whole query char-by-char can leak stray keystrokes into an
   *      already-committed neighbouring field ("NYPington") → bulk `fill` the body,
   *      type only the last char.
   * Every wait here is event-driven (`waitFor({ state })`); the outer loop is bounded and
   * throws loudly rather than letting a half-filled form fail downstream as a mystery
   * "FIND TRAINS still disabled". `field` is the container (see `stationField`); the input
   * and its option list are both resolved inside it so a sibling field can't cross-talk.
   * See docs/FRAMEWORK.md ➜ "Typing into the autocomplete".
   */
  private selectStationInto = async (field: Locator, query: string): Promise<void> => {
    const input = field.locator('input');
    // Target the option by 3-letter code and verify the commit against it — "first
    // plausible option" sometimes lands on the wrong station on slower engines.
    const code = stationCode(query);
    if (!code) {
      throw new Error(`selectStationInto: "${query}" is not a known station — add it to STATIONS in test-data.ts`);
    }
    const isCommittedText = (text: string): boolean => text === code || text.includes(`(${code})`);
    const readInputText = async (): Promise<string> => ((await input.inputValue().catch(() => '')) ?? '').trim();
    const codedOption = field.getByRole('option').filter({ hasText: new RegExp(`\\(${code}\\)`) }).first();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      // A prior attempt may have committed it (input now a chip) — don't wipe a good value.
      if (isCommittedText(await readInputText())) {
        return;
      }
      // On a retry the input may be that chip — click the container to re-open it.
      if (!(await input.isVisible().catch(() => false))) {
        await field.click({ force: true }).catch(() => undefined);
      }
      await input.click();
      await input.fill('');

      // Bulk-set atomically (no per-char leak — "NYPington"), then one real keystroke.
      await input.fill(query.slice(0, -1));
      await input.pressSequentially(query.slice(-1), { delay: 60 });

      let optionVisible = await codedOption.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
      if (!optionVisible) {
        // No response — `fill`'s synthetic `input` event isn't always trusted enough.
        // Re-type the whole query as real keystrokes.
        await input.click();
        await input.fill('');
        await input.pressSequentially(query, { delay: 60 });
        optionVisible = await codedOption.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
      }

      if (optionVisible) {
        // The list can rebuild mid-click; retry, then fall back to keyboard select.
        let optionClicked = false;
        for (let clickAttempt = 0; clickAttempt < 4 && !optionClicked; clickAttempt += 1) {
          optionClicked = await codedOption.click({ timeout: 3_000 }).then(() => true).catch(() => false);
          if (!optionClicked) {
            await codedOption.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined);
          }
        }
        if (!optionClicked) {
          await input.press('ArrowDown').catch(() => undefined);
          await input.press('Enter').catch(() => undefined);
        }

        // Success collapses the input to a chip — check now, else wait for that (event-driven).
        if (isCommittedText(await readInputText())) {
          return;
        }
        if (await input.waitFor({ state: 'hidden', timeout: 3_000 }).then(() => true).catch(() => false)) {
          if (isCommittedText(await readInputText())) {
            return;
          }
        }
      }

      await input.fill('').catch(() => undefined);
      await this.page.keyboard.press('Escape').catch(() => undefined);
    }

    // Fail loudly here, not downstream with a mystery "FIND TRAINS still disabled".
    throw new Error(`Could not commit station "${query}" after 5 attempts`);
  };

  selectDepartureDate = async (date: Date): Promise<void> => {
    await this.pickDate(this.departDateInput(), date);
  };

  /** "No past dates" helper — opens the departure calendar, reports if `date` is pickable. */
  isDepartureDateSelectable = async (date: Date): Promise<boolean> => {
    await this.departDateInput().click({ force: true });
    if (!(await this.calendar().isVisible({ timeout: 8_000 }).catch(() => false))) {
      return false;
    }
    const monthReached = await this.walkCalendarToMonth(date);
    const dayCell = this.calendarDay(date);
    if (!monthReached || !(await dayCell.count())) {
      await this.page.keyboard.press('Escape').catch(() => undefined);
      return false;
    }
    const ariaDisabled = await dayCell.getAttribute('aria-disabled').catch(() => null);
    const className = (await dayCell.getAttribute('class').catch(() => '')) ?? '';
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
    const stepperButton = delta >= 0 ? this.addPassengerButton(type) : this.removePassengerButton(type);
    for (let step = 0; step < Math.abs(delta); step += 1) {
      await stepperButton.click();
    }
  };

  /** Click "Reset" in the Travelers popover. Reverts every type to the default (1 adult). */
  resetTravelers = async (): Promise<void> => {
    await this.openTravelers();
    await this.resetTravelersButton().click();
  };

  /** Set the whole party mix, stepping each type from the form default to the target. */
  private setPassengers = async (counts: Partial<PassengerCounts>): Promise<void> => {
    const targetCounts: PassengerCounts = { ...DEFAULT_PASSENGERS, ...counts };
    await this.openTravelers();
    for (const type of Object.keys(targetCounts) as PassengerType[]) {
      await this.adjustPassenger(type, targetCounts[type] - DEFAULT_PASSENGERS[type]);
    }
    await this.page.keyboard.press('Escape');
  };

  /** Fill the whole form from a {@link TripSearch} — the multi-field "login-style" journey.
   *  Deliberately **does not** press "Find trains" — that click stays in the test. */
  fillSearch = async (trip: TripSearch): Promise<void> => {
    await this.selectTripType(trip.tripType);

    if (trip.tripType === 'multi-city' && trip.legs?.length) {
      await this.fillLegs(trip.legs);
    } else {
      await this.selectStation('from', trip.from);
      await this.selectStation('to', trip.to);
      if (trip.tripType === 'round-trip' && trip.returnDate) {
        // RT uses one range calendar — pick both dates in a single open or the range drops.
        await this.pickDateRange(trip.departDate, trip.returnDate);
      } else {
        await this.selectDepartureDate(trip.departDate);
      }
    }

    if (hasNonDefaultPassengers(trip.passengers)) {
      await this.setPassengers(trip.passengers);
    }
  };

  /** Multi-City: fill each leg's From / To / Depart, adding leg rows as needed. */
  private fillLegs = async (legs: TripLeg[]): Promise<void> => {
    for (let legIndex = 0; legIndex < legs.length; legIndex += 1) {
      // Wait for this leg's row to render; only Add Trip if it genuinely never appears
      // (not off a flickering count — Multi-City shows two rows by default).
      const legFromInput = this.stationField('from', legIndex).locator('input');
      const rowRendered = await legFromInput
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (!rowRendered) {
        await this.addTripButton().click();
        await legFromInput.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
      }
      await this.selectLegStation(legIndex, 'from', legs[legIndex].from);
      await this.selectLegStation(legIndex, 'to', legs[legIndex].to);
      await this.selectLegDepartureDate(legIndex, legs[legIndex].departDate);
    }
  };

  // ---------------------------------------------------------------------------
  // Private calendar helpers
  // ---------------------------------------------------------------------------

  private pickDate = async (field: Locator, date: Date): Promise<void> => {
    // Success = the calendar dismissing itself; the RT depart input doesn't echo its value.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await field.click({ force: true });
      const calendarOpened = await this.calendar()
        .waitFor({ state: 'visible', timeout: 6_000 })
        .then(() => true)
        .catch(() => false);
      if (!calendarOpened) {
        continue;
      }

      await this.walkCalendarToMonth(date);
      const dayCell = this.calendarDay(date);
      if (await dayCell.isVisible().catch(() => false)) {
        await dayCell.click();
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
      const calendarOpened = await this.calendar()
        .waitFor({ state: 'visible', timeout: 6_000 })
        .then(() => true)
        .catch(() => false);
      if (!calendarOpened) {
        continue;
      }

      for (const date of [departDate, returnDate]) {
        await this.walkCalendarToMonth(date);
        const dayCell = this.calendarDay(date);
        if (await dayCell.isVisible().catch(() => false)) {
          await dayCell.click();
        }
      }

      const doneButton = this.page.getByRole('button', { name: 'Done', exact: true }).filter({ visible: true }).first();
      if (await doneButton.isVisible().catch(() => false)) {
        await doneButton.click().catch(() => undefined);
      }

      if (await this.ensureCalendarClosed()) {
        return;
      }
    }
    await this.ensureCalendarClosed();
  };

  /** Dismiss any leftover datepicker overlay. `Escape` does it; the `<h1>` click is a
   *  defensive outside-click (a role target, not a coordinate). */
  private ensureCalendarClosed = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
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
    const targetIsInFuture = stripTime(date) >= stripTime(new Date());
    for (let attempt = 0; attempt < 18; attempt += 1) {
      if (await this.calendarDay(date).isVisible().catch(() => false)) {
        return true;
      }
      const navButton = targetIsInFuture ? this.calendarNextMonthButton() : this.calendarPreviousMonthButton();
      if (await navButton.isDisabled().catch(() => true)) {
        return this.calendarDay(date).isVisible().catch(() => false);
      }
      await navButton.click();
      // Wait for the target day to render instead of a fixed sleep; lapses if this month
      // doesn't contain it and the loop pages on.
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

/** The widget's own (inconsistently singular/plural) key per traveler type in its stepper test-ids. */
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
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
};

const hasNonDefaultPassengers = (counts: PassengerCounts): boolean =>
  (Object.keys(counts) as PassengerType[]).some((type) => counts[type] !== DEFAULT_PASSENGERS[type]);
