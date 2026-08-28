# Framework design

How the framework is put together and the rules it enforces.

## Layers

```
spec  (tests/**/*.spec.ts)         actions + assertions, reads like English
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
`url()`, and a best-effort `dismissConsentBanners()`. Component objects get the parallel
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
fromStationInput = (): Locator => this.page.locator('input#am-form-field-control-0');
addPassengerButton = (type: PassengerType): Locator =>
  this.page.getByRole('button', { name: `+ Add ${SINGULAR[type]}`, exact: true });
```

Parameterised where it helps (`calendarDay(date)`, `errorByText(text)`). They return a
`Locator` and never act or assert.

### Locator priority

`getByRole` → `getByLabel` → `.locator(css)` → raw css. In practice, because the widget
is a dense Angular app with duplicated mobile/desktop nodes and repeated accessible
names, the most *stable* hook is often Amtrak's own `amt-auto-test-id` attribute, so the
real order applied is:

1. `getByRole` / `getByLabel` when the role + accessible name are unambiguous
   (`FIND TRAINS` button, `Next month`, calendar `gridcell` by date label);
2. `[amt-auto-test-id="…"]` where Amtrak provides one (trip-type button, coupon toggle,
   traveler button, fare-finder container);
3. `#am-form-field-control-N` / css for the few controls with neither — each tagged
   `// VERIFY:` with a note on why.

`Locator.or(...)` and `.filter({ visible: true })` are used to make a single accessor
tolerate small DOM changes and the mobile/desktop duplication.

### Actions vs. methods

| Belongs in the **spec** | Belongs in the **Page Object** |
| --- | --- |
| A single `click()` / `fill()` / `check()` | A multi-field journey — the "login-style" flow |
| The "Find trains" button click | `fillSearch(trip)` — trip type + stations + dates + pax + coupon |
| `swapStationsButton().click()` | `selectStation(field, query)` — focus, type, wait for the listbox, pick the matching option, verify it committed (with retry) |
| Opening the traveler popover | `selectDepartureDate(date)` — open calendar, walk to the month, click the day, confirm it closed |
| | `setPassengers({ adults: 2 })` — open popover, step each type to target, close |

`fillSearch` deliberately **stops before** pressing "Find trains" — that click stays in
the spec, next to the assertion about what it produced.

### Assertions live in specs, never in Page Objects

Page Objects expose `Locator`s and return plain values (`isDateSelectable(): Promise<boolean>`).
The spec does the `expect(...)`. Enforced by lint (below).

### Test data — Builder pattern

`src/data/test-data.ts`:

```ts
const trip = TripSearchBuilder.aTrip()
  .roundTrip(21)
  .from(STATIONS.boston.query)
  .to(STATIONS.philadelphia.query)
  .departingInDays(10)
  .withPassengers({ adults: 2 })
  .build();
```

Defaults live in one place; specs state only what's salient to them.

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
| `fullyParallel` + `workers` | `true`, `4` | Assignment requirement — 4 parallel workers by default (`PW_WORKERS` overrides). |
| `projects` | Chromium, Firefox, WebKit, Pixel 7 | Cross-browser + one mobile viewport for responsive coverage. |
| `retries` | `1` local / `2` CI | Absorbs the live site's occasional autocomplete lag. |
| `trace` / `screenshot` / `video` | on failure / first retry | Debuggable failures, cheap green runs. |
| `globalSetup` | reachability probe | Non-fatal; logs whether Amtrak answered so a wall of skips is easy to explain. |
| `reporter` | `list` + `html` + `junit` | Console feedback, rich local report, CI-parseable XML. |
| `use.locale` / `timezoneId` | `en-US` / `America/New_York` | Deterministic date labels in the calendar. |

## Resilience

- **Consent**: `src/support/consent.ts` pre-seeds the OneTrust cookies so the banner
  never renders; `BasePage.dismissConsentBanners()` is a fallback click.
- **Bot wall / outage**: the `beforeEach` in `pom.fixtures.ts` checks the widget is
  interactive and `test.skip()`s with a reason if not.
- **Flaky multi-step journeys**: `selectStation` and `pickDate` verify their own effect
  (value committed / calendar dismissed) and retry internally before giving up.
