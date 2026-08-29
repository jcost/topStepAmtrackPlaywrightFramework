# Framework design

How the framework is put together and the rules it enforces.

## Test organisation — folders for location, tags for type

Two independent axes, kept independent so neither forces a reshuffle of the other:

| Axis | Mechanism | Values (today) |
| --- | --- | --- |
| **Where a test runs / what it covers** | directory | `tests/ui/<domain>/`, `tests/api/<domain>/` — one domain, `find-trains` |
| **What kind of test it is** | Playwright tag + `[type]` title prefix | exactly two: `@smoke`, `@regression` |

### The two types

| Type | Meaning | Example |
| --- | --- | --- |
| **`@smoke`** | Non-mutating UI interaction — fill fields, click, toggle, assert on-page state. Nothing is created / updated / deleted; the test does not leave the screen under test. | Fill From/To/date, assert "Find trains" enables |
| **`@regression`** | The test proceeds *past a boundary* into the app — a results page, a booking step, anything that mutates state. | Submit the search and assert results render (out of scope here) |

Only these two. No `@edge`, no `@e2e`. **This suite stops at the "Find trains" button
click, so every test in it is `@smoke`** — there are no `@regression` tests yet, and that
is expected for the assignment scope. The tag exists for when the suite grows past the
button.

```
tests/
├── ui/find-trains/                  # browser-driven, uses Page Objects (src/pages/)
│   ├── station-selection.spec.ts    # From/To autocomplete, same-station rule
│   ├── trip-type.spec.ts            # Multi-City reshaping (RT reshaping covered by the RT submit)
│   ├── departure-date.spec.ts       # depart calendar constraints
│   ├── passenger-selection.spec.ts  # traveler popover + steppers
│   └── search-submission.spec.ts    # Find trains button gating + firing the request
└── api/find-trains/                 # request-context driven, uses API clients (src/clients/) — scaffold
    └── README.md
```

One spec file per **feature of the form**, named for what it covers. Test titles say what
happens on the app (`[smoke] the same station in From and To leaves Find trains disabled`),
so the reporter output reads as a description of behaviour.

- **Directories never change** as test types are added — you never move a file to
  "promote" it from smoke to regression, you retag it.
- **The type is in the title too** — every test name is prefixed `[smoke]` / `[regression]`
  so the type is legible in the reporter output and the Playwright UI, not just via
  `--grep`. The prefix and the `tag` must always agree.
- **Tags compose across the whole tree**: `playwright test --grep @smoke` runs the smoke
  subset of *every* domain and *both* platforms.
- **`src/pages/` (POM) is not under `tests/`** — it is shared framework code. The API
  layer gets a parallel `src/clients/`. Specs are the only thing in `tests/`.

The per-test mapping is enumerated in [TEST-PLAN.md](TEST-PLAN.md).

## Layers

```
spec  (tests/{ui,api}/<domain>/*.spec.ts)   actions + assertions, reads like English
  │   imports { test, expect } from src/fixtures/pom.fixtures
  ▼
fixture  (src/fixtures/pom.fixtures.ts)   creates & injects Page Objects, one per test
  │
  ▼
Page Object  (src/pages/**)         locators (arrow fns) + multi-step journeys, NO assertions
  │   HomePage ─ owns ─▶ FindTrainsForm (component object)
  ▼
Playwright  (Page, Locator)
```

### Shared base — `BasePage`

`src/pages/base.page.ts`. Holds what every page needs: a `page` handle, `navigate(path)`,
and a best-effort `dismissConsentBanners()`. Component objects get the parallel
`BaseComponent`. Both are abstract and assertion-free by contract (and by lint rule).

### Component object — `FindTrainsForm`

The search widget is big enough to be its own object rather than a pile of methods on
`HomePage`. `HomePage` composes it:

```ts
class HomePage extends BasePage {
  readonly findTrainsForm = new FindTrainsForm(this.page);
}
```

Specs reach it as `homePage.findTrainsForm.fromStationInput()`. When the homepage grows
(global nav, alerts banner, deals carousel) each becomes another component object on
`HomePage` — no spec churn.

## Conventions

### Locators are arrow-function properties

```ts
// the <station-search> wrapper carries the test-id; the <input> lives inside it
private stationField = (field: 'from' | 'to', index = 0): Locator =>
  this.page
    .locator(`[amt-auto-test-id="fare-finder-${field}-station-field-page"]`)
    .filter({ visible: true })
    .nth(index);
fromStationInput = (): Locator => this.stationField('from').locator('input');
addPassengerButton = (type: PassengerType): Locator =>
  this.page
    .locator(`[amt-auto-test-id="traveler-component-${TRAVELER_KEY[type]}-incr-button"]`)
    .filter({ visible: true });
```

Parameterised where it helps (`calendarDay(date)`, `legFromInput(index)`). They return a
`Locator` and never act or assert.

### Locator priority

The goal is the **most stable, least-changing hook for that specific field**. Order,
most-stable first:

1. **`[amt-auto-test-id="…"]`** — an attribute Amtrak added *for* test automation. When
   one exists (and isn't duplicated/mislabeled) it is the single stablest hook, because
   its whole reason to exist is being targeted by tests. Used for: fare-finder container,
   FIND TRAINS button, trip-type trigger, `multi-city-add-trip` / `multi-city-remove-trip`,
   both station fields (`fare-finder-{from,to}-station-field-page` on the `<station-search>`
   wrapper — `.locator('input')` / `.getByRole('option')` reach the input and its own
   autocomplete list inside it), each depart-date input (`fare-finder-depart-date-oneway`),
   the traveler button, the steppers (`traveler-component-<key>-incr/dcr-button`),
   `traveler-clear` (Reset) and `traveler-component-discount-done-button` (Done).
2. **`getByRole`** (role + accessible name) — `Next month` / `Previous month`, calendar
   `gridcell` by date label, the trip-type menu items (the buttons that *do* carry a
   test-id have no accessible name — a `data-julie` side channel), the autocomplete
   `option`s and `listbox` (scoped inside the field container, above).
3. **`getByLabel`**.
4. **A unique, stable `id`** — none needed any more; the station inputs moved to their
   wrapper's test-id (tier 1).
5. **css** — `aria-labelledby` for the two date fields (`ff-depart-ow-label` /
   `ff-rt-depart-label` / `ff-rt-return-label`: the depart/return test-ids are on four
   inputs and one is mislabeled, so the per-field label id is the stablest hook);
   `.calendar-modal, .am-datepicker` for the ng-bootstrap calendar container (third-party,
   no Amtrak test-ids).

Tier-5 accessors are tagged `// VERIFY:` with the reason. No `.or(...)` fallback chains —
if a test-automation id is ever removed, the locator should break loudly there (a clear
one-line fix) rather than silently drop to a fragile text match.

`.filter({ visible: true })` is used to pick the *rendered* one of a set of duplicated
nodes — Amtrak ships the widget twice (desktop + mobile), and Multi-City renders one
station field / date input per leg plus a hidden leftover One-Way/Round-Trip copy. It is
also why the station accessors filter the **container**, not the `<input>`: once a station
is committed the widget collapses its input to a code chip (`input:visible` would match
nothing) while the `<station-search>` stays visible.

`.first()` is kept **only** where a locator still resolves to more than one element after
that (checked against the live DOM 2026-08-29): `findTrainsButton` /
`addTripButton` / `removeTripButton` (test-id ×2 + a re-render fade window), `calendar`
(the union matches the outer wrapper and inner picker, both visible), and
`passengerRequirementError` (the message is printed on two nodes). Elsewhere it was
dropped so strict mode surfaces a future regression instead of a `.first()` hiding it.

### Typing into the autocomplete

`selectStationInto` sets the search text with **`fill`** for all but the last character
and types only the last one for real (`typeStation`). `fill` is atomic — a single `input`
event, which is all Amtrak's autocomplete needs — so nothing can leak into a
previously-committed field when focus shifts mid-interaction (the `"NYPington"` bug).
The single trailing keystroke fires the `keyup` the widget listens on. Options are then
matched **by 3-letter code**, scoped to that field's own list, and the committed value is
verified against the code (4 attempts, then a loud `throw`).

**Not used: `data-julie`.** Amtrak's virtual-assistant hooks (`data-julie="fromfield_booking"`,
`"roundtrip"`, …) look tempting but (a) `fromfield_booking` / `tofield_booking` /
`departdisplay_booking_oneway` are reused for **every** Multi-City leg, so no more unique
than `aria-label="From"`; (b) the `data-julie="oneway|roundtrip|multicity"` buttons carry
no accessible name and sit by the submit button, not in the visible menu — a side channel,
not what a user clicks.

### Actions vs. methods

| Belongs in the **spec** | Belongs in the **Page Object** |
| --- | --- |
| A single `click()` / `fill()` / `check()` | A multi-field journey — the "login-style" flow |
| The "Find trains" button click | `fillSearch(trip)` — trip type + stations + dates + party mix (+ multi-city legs) |
| `findTrainsButton().click()` | `selectStation(field, query)` — focus, type, wait for the listbox, pick by station code, verify it committed (with retry) |
| `adjustPassenger('adults', 1)` | `selectDepartureDate(date)` — open calendar, walk to the month, click the day, confirm it closed |
| `resetTravelersButton().click()` | `fillLegs(legs)` — add rows, then fill each leg's From / To / Depart |

`fillSearch` deliberately **stops before** pressing "Find trains" — that click stays in
the spec, next to the assertion about what it produced.

### Assertions live in specs, never in Page Objects

Page Objects expose `Locator`s and return plain values (`isDateSelectable(): Promise<boolean>`).
The spec does the `expect(...)`. Enforced by lint (below).

### Test data — Builder pattern

`src/data/test-data.ts`:

```ts
const trip = TripSearchBuilder.aTrip()
  .oneWay()
  .from(STATIONS.newYork.query)
  .to(STATIONS.washington.query)
  .departingInDays(DEPART_LEAD_DAYS)
  .withPassengers({ adults: 2, children: 1 })
  .build();
```

Defaults live in one place; specs state only what's salient to them. Methods:
`.oneWay()` / `.roundTrip(days)` / `.multiCity(legs)`, `.from()` / `.to()`,
`.departingInDays()`, `.withPassengers()`, `.build()`. `standardTripFor(tripType)` wraps
the builder to return the canonical trip per bookable type, which the parameterized submit
test loops over; the passenger-mix test above builds its trip inline.

## The guard rails (enforced by `npm run lint`)

### Guard 1 — no raw locators / no Page Object instantiation in tests

Custom rule `pom/no-raw-locators` (`eslint-rules/pom-plugin.mjs`), scoped to
`tests/**/*.spec.ts`:

- flags `.getByRole(` / `.getByLabel(` / `.getByText(` / `.getByPlaceholder(` /
  `.getByTestId(` / `.getByAltText(` / `.getByTitle(` / `.locator(` / `.frameLocator(` /
  `.$(` / `.$$(` / `.$eval(` / `.$$eval(` — the message tells you to put the locator on a
  Page Object and inject it;
- flags `new FooPage()` / `new FooComponent()` — the message tells you to register it in
  `pom.fixtures.ts`.

Plus `no-restricted-imports`: a spec may not import `@playwright/test` (use the fixtures
module) or anything under `**/pages/**` (inject via the fixture).

```
✗ await page.getByRole('button', { name: 'Find trains' }).click();
      Raw locator `.getByRole(...)` is not allowed in a test. Add this locator as an
      arrow-function property on a Page Object and reach it through the injected fixture.

✓ await homePage.findTrainsForm.findTrainsButton().click();
```

### Guard 2 — no assertions in Page Objects

`no-restricted-syntax` scoped to `src/pages/**` flags `expect(...)`, `expect(...).toX()`
and `expect.poll(...)`.

```
✗ (in a Page Object)  await expect(this.fromInput()).toBeVisible();
      Assertions belong in tests, not Page Objects.
```

### Adding a new page surface (the only supported way)

1. `src/pages/checkout.page.ts` — `export class CheckoutPage extends BasePage { … }`
2. `src/fixtures/pom.fixtures.ts` — add `checkoutPage: CheckoutPage` to `PageObjects`
   and a fixture entry in `base.extend`.
3. Use it: `test('…', async ({ checkoutPage }) => { … })`.

Guard 1 makes any shortcut around this fail CI.

## Playwright config choices (`playwright.config.ts`)

| Setting | Value | Why |
| --- | --- | --- |
| `fullyParallel` + `workers` | `true`, `4` | 4 parallel workers by default (`PW_WORKERS` overrides). |
| `projects` | `mocked-chromium`, `mocked-mobile`, `live-chromium` | See "The two lanes" below. |
| `retries` | `2` all projects | Single-leg tests never use it; it exists for the multi-city submit (mocked) and bot-protection/latency (live). |
| `trace` / `screenshot` / `video` | on failure / first retry | Debuggable failures, cheap green runs. |
| `globalSetup` | reachability probe | Non-fatal; logs whether Amtrak answered so a wall of skips is easy to explain. |
| `reporter` | `list` + `html` + `junit` | Console feedback, rich local report, CI-parseable XML. |
| `use.locale` / `timezoneId` | `en-US` / `America/New_York` | Deterministic date labels in the calendar. |

### The two lanes

| Project | `mockAmtrakApi` | What it proves | Gate? |
| --- | --- | --- | --- |
| `mocked-chromium` | `true` | The full Angular widget — typing, option rendering, value commit, `aria-disabled` validation gating, trip-type/calendar/traveler behaviour, and the `journey-solution-option` **request payload** — all against a **stubbed** `getResponseList` so the flaky geocoder latency is out of the picture. | **Yes** — must be green. |
| `mocked-mobile` | `true` | Same, on the Pixel 7 viewport. | Bonus. |
| `live-chromium` | `false` | The real site still serves a widget we can drive, and the real autocomplete payload still has the shape the mocks assume. Catches API drift the mocks can't. | No — allowed to flake / skip. |

The mock replaces **one network response** (the station lookup), not the thing under
test. Everything the widget does with that data — and everything else on the form — runs
for real. `journey-solution-option` is intercepted to *read* the outgoing payload and
aborted; it is never faked into a "success". See `src/support/mocks/`.

## Resilience

- **Consent**: `src/support/consent.ts` pre-seeds the OneTrust cookies so the banner
  never renders; `BasePage.dismissConsentBanners()` is a fallback click.
- **Bot wall / outage**: the `beforeEach` in `pom.fixtures.ts` checks the widget is
  interactive and `test.skip()`s with a reason if not.
- **Flaky multi-step journeys**: `selectStation` and `pickDate` verify their own effect
  (value committed / calendar dismissed) and retry internally before giving up.
