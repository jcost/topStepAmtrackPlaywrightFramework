# Framework design

## Layers

```
spec  (tests/ui/<domain>/*.spec.ts)   actions + assertions, reads like English
  │   imports { test, expect } from src/fixtures/pom.fixtures
  ▼
fixture  (src/fixtures/pom.fixtures.ts)   creates & injects Page Objects, one per test
  ▼
Page Object  (src/pages/**)   locators (arrow fns) + multi-step journeys, NO assertions
  │   HomePage ─ owns ─▶ FindTrainsForm (component object)
  ▼
Playwright  (Page, Locator)
```

- **`BasePage`** (`src/pages/base.page.ts`) — a `page` handle, `navigate(path)`, a
  best-effort `dismissConsentBanners()`. Component objects get the parallel `BaseComponent`.
  Both abstract and assertion-free by contract *and* lint rule.
- **`FindTrainsForm`** is a **component object** (the widget is too big to be methods on
  `HomePage`). `HomePage` composes it; new homepage regions become sibling component
  objects — no spec churn.

## Test organisation — folders for location, tags for type

- **Directory = `tests/<platform>/<domain>/`** — today just `tests/ui/find-trains/`.
  Directories never change to "promote" a test; you retag it.
- **Tag = type**, exactly two: `@smoke` (non-mutating UI interaction) and `@regression`
  (proceeds past a boundary into the app). This suite stops at the button click, so every
  test is `@smoke`; there are no `@regression` tests yet. `--grep @smoke` composes across
  the whole tree.
- **`src/pages/` (POM) is not under `tests/`** — it's shared framework code. Specs are the
  only thing in `tests/`.

One spec file per **feature of the form**; titles say what happens on the app so reporter
output reads as a behaviour description. Per-test coverage is in [APPROACH.md](APPROACH.md).

## Conventions

### Locators — arrow-function properties on Page Objects, never in specs

```ts
private stationField = (field: 'from' | 'to', index = 0): Locator =>
  this.root()
    .locator(`[amt-auto-test-id="fare-finder-${field}-station-field-page"]`)
    .filter({ visible: true })
    .nth(index);
fromStationInput = (): Locator => this.stationField('from').locator('input');
```

**Priority, most-stable first:** `[amt-auto-test-id="…"]` (Amtrak's own automation hooks —
used for the container, submit button, trip-type trigger, add/remove-trip, both station
fields, depart-date inputs, the traveler button + steppers + Reset/Done) → `getByRole`
(calendar nav & cells, trip-type menu items, autocomplete options/listbox) → `getByLabel`
→ stable `id` → css. The only css left is `aria-labelledby` on the two date inputs (their
test-ids are duplicated / mislabeled) and `.calendar-modal, .am-datepicker` for the
third-party ng-bootstrap calendar — both tagged `// VERIFY:`.

- **No `.or(...)` fallback chains** — a removed test-id should break loudly, not slide to a
  fragile text match.
- **`.filter({ visible: true })`** picks the rendered node of a duplicated set (Amtrak
  ships the widget desktop + mobile; Multi-City renders one field per leg). Station
  accessors filter the **container**, not the `<input>` — a committed field collapses its
  input to a code chip while the `<station-search>` stays visible.
- **`.first()`** only where a locator genuinely resolves to >1 element after that
  (`findTrainsButton`, add/remove-trip, `calendar`, `passengerRequirementError`).

### Actions vs. multi-step methods

| Belongs in the **spec** | Belongs in the **Page Object** |
| --- | --- |
| A single `click()` / `fill()` / `check()` | `fillSearch(trip)` — trip type + stations + dates + party mix (+ legs) |
| `findTrainsButton().click()` | `selectStation(field, query)` — type, wait for the list, pick by station code, verify committed (with retry) |
| `adjustPassenger('adults', 1)` | `selectDepartureDate(date)` — open calendar, walk to month, click day, confirm closed |

`fillSearch` deliberately **stops before** pressing "Find trains" — that click stays in the
spec next to the assertion.

### Typing into the autocomplete — why `selectStationInto` is unusual

The From/To field is a **debounced Angular autocomplete on a live third-party site**, and
the obvious approach — `input.fill(query)` then click the first `option` — flaked ~1 run in
20. It's the one place in the framework where a Page Object method is noticeably more
involved than "locate → act", and that's deliberate. Three separate failure modes, each
with a guard:

| Failure mode | Guard |
| --- | --- |
| `fill()` fires a *synthetic* (`isTrusted: false`) `input` event that the widget sometimes ignores → no search, no options | after the `fill` + one real keystroke, if the option doesn't appear, **re-type the whole query as real keystrokes** |
| The option list rebuilds between "visible" and "clicked" (a trailing debounced response) → the element detaches mid-click | **click-retry**, then an `ArrowDown` + `Enter` **keyboard fallback** (immune to the detach) |
| Typing char-by-char can leak stray keystrokes into an already-committed neighbouring field ("NYPington") | `fill` the body in one shot, press only the **last char** for real |

Everything waits on `waitFor({ state })` (no fixed sleeps); commit is confirmed by the
input collapsing to a code chip. The loop is bounded (5 attempts) and throws a clear
`Could not commit station "…"` rather than letting a half-filled form fail downstream as a
mystery "FIND TRAINS still disabled". A cleaner "real keystrokes only, wait for the
response" rewrite was prototyped and **stress-tested at 116/120 vs this version's 120/120**
— it lost, so the shape here is the one that survives.

### Assertions live in specs, never in Page Objects

Page Objects expose `Locator`s and return plain values
(`isDepartureDateSelectable(): Promise<boolean>`). The spec does the `expect(...)`.

### Test data — Builder pattern (`src/data/test-data.ts`)

```ts
const trip = TripSearchBuilder.aTrip()
  .oneWay().from(STATIONS.newYork.query).to(STATIONS.washington.query)
  .departingInDays(DEPART_LEAD_DAYS).withPassengers({ adults: 2, children: 1 }).build();
```

Defaults in one place; specs state only what's salient. `standardTripFor(tripType)` wraps
the builder to return the canonical trip per bookable type (the parameterized submit test
loops over it). `expectedLegsFor(trip)` is the matching pure function on the assertion
side — turns a `TripSearch` into the legs the request should carry.

## Guard rails (enforced by `npm run lint`)

1. **No raw locators / no `new *Page()` in specs** — custom rule `pom/no-raw-locators`
   (`eslint-rules/pom-plugin.mjs`) flags `.getByRole(` / `.locator(` / `.$(` / … and
   `new FooPage()` in `tests/**/*.spec.ts`. Plus `no-restricted-imports`: a spec imports
   `test`/`expect` from the fixtures module, never `@playwright/test` or `**/pages/**`.
   ```
   ✗ await page.getByRole('button', { name: 'Find trains' }).click();
   ✓ await homePage.findTrainsForm.findTrainsButton().click();
   ```
2. **No assertions in Page Objects** — `no-restricted-syntax` on `src/pages/**` flags
   `expect(...)` / `expect.poll(...)`.

## Playwright config (`playwright.config.ts`)

| Setting | Value | Why |
| --- | --- | --- |
| `fullyParallel` + `workers` | `true`, `4` | `PW_WORKERS` overrides |
| `retries` | `1`, all projects | `selectStationInto` already retries internally; this is the outer net for a transient render hiccup. A flake that survives both is a real bug. |
| `trace` / `screenshot` / `video` | `retain-on-failure` | full trace whenever a test ends failed; nothing on green runs |
| `globalSetup` | reachability probe | non-fatal; logs whether Amtrak answered |
| `reporter` | `list` + `html` + `junit` | console + rich local report + CI XML |
| `use.locale` / `timezoneId` | `en-US` / `America/New_York` | deterministic calendar date labels; `process.env.TZ` is pinned to the same zone so Node's date math agrees with the browser (CI runners are UTC — otherwise the past-date test flips near midnight) |

### The three projects / two lanes

| Project | `mockAmtrakApi` | What it proves | Gate? |
| --- | --- | --- | --- |
| `mocked-chromium` | `true` | The full Angular widget — typing, option rendering, value commit, `aria-disabled` gating, trip-type/calendar/traveler behaviour, and the `journey-solution-option` **payload** — against a stubbed `getResponseList`. `station-selection.spec.ts` → "against the real autocomplete" opts out. | **Yes** — must be green (those 2 tests may `test.skip` if blocked) |
| `mocked-mobile` | `true` | Same, Pixel 7 viewport | Signal |
| `live-chromium` | `false` | Every spec against the real site + real autocomplete — catches API drift the mocks can't | No — may flake / skip |

The mock replaces **one network response** (the station lookup) for the tests that only
use station selection as a *precondition* — never the thing a test asserts. The
autocomplete's own tests always hit the real service. `journey-solution-option` is
intercepted to *read* the payload and aborted — never faked into a success.

## Resilience

- **Consent** — `src/support/consent.ts` pre-seeds OneTrust cookies so the banner never
  renders; `dismissConsentBanners()` is a fallback click.
- **Bot wall / outage** — `pom.fixtures.ts` `beforeEach` checks the widget is interactive:
  **live** lane `test.skip()`s with a reason; **mocked** lanes **fail** (no bot wall to
  blame → selector drift or an app change).
- **Flaky journeys** — `selectStation` / `pickDate` verify their own effect and retry
  internally before giving up.

## Scaling to more of amtrak.com

| Grow by | How |
| --- | --- |
| Another region of the same page | A new component object on `HomePage` (`GlobalHeader`, `AlertsBanner`) — no fixture or spec churn |
| Another page | A new `*.page.ts` extending `BasePage` + one entry in `pom.fixtures.ts` (`PageObjects` + `base.extend`). Guard 1 blocks any other way in. |
| Another site area | A new `<domain>` folder under `tests/ui/`; nothing else moves |
| An API layer | `tests/api/<domain>/` + `src/clients/<name>.client.ts` (a thin `APIRequestContext` wrapper — the "Page Object" of the API) + `src/fixtures/api.fixtures.ts`, mirroring the POM guard. An `api` project with `testMatch: /tests\/api\//` and no browser. |
| More test data | Drive `TripSearchBuilder` from a table of `(from, to, tripType, pax)` rows; move `STATIONS` to a JSON fixture when it grows |
| A `@regression` lane | Stub `journey-solution-option` with a canned solution set, drive *past* the button, assert on rendered results — still no live backend |
| More quality signals | `@axe-core/playwright` (no serious violations per component + keyboard-only completion); `toHaveScreenshot` visual baselines; a performance-budget check; component-contract tests against a Storybook mount |
| CI as it grows | `--shard=i/n` across matrix jobs; `mocked` on every PR, `live` on a schedule from an allow-listed IP; publish the HTML report; `--reporter=blob` + `merge-reports` for flake tracking |

What stays constant: the guard rules, the `BasePage` / component-object split, fixture
injection, "locators in Page Objects, assertions in specs", and the Builder — what keeps a
12-test suite and a 1,200-test suite readable the same way.

## Source control / branching

Built solo, so commits went straight to `main`. In a team I'd branch off `develop`
(company convention permitting): a short-lived `test/<area>` branch per change,
PR-reviewed, merged to `develop`, then `develop` → `main` on an agreed cadence — `main`
being what CI gates on. `npm run check` + `npm run test:mocked` are the same gate on any
branch.
