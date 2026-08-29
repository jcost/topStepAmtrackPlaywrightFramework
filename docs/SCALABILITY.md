# Scaling this framework

The brief asks to show how the framework grows to cover more of amtrak.com. Here's the
path, cheapest first.

## 0. The two axes it's already built on

- **Directory = platform × domain**: `tests/<platform>/<domain>/`. Today just
  `tests/ui/find-trains/`; a new area of the site (e.g. `train-status`, `account`) is a
  new `<domain>` folder, and an API layer is a sibling `tests/api/<domain>/`.
- **Tag = test type**: exactly two — `@smoke` (non-mutating UI interaction) and
  `@regression` (proceeds past a boundary into the app). Changing a test's type is a
  retag, never a move. `--grep @smoke` composes across every domain and platform.

A file never changes directory to change its type, and a new domain never disturbs an
existing one. See [FRAMEWORK.md](FRAMEWORK.md) → *Test organisation*.

### The API layer

There are no API tests today. Adding one mirrors the UI side exactly — a new
`tests/api/find-trains/` folder plus:

```
src/clients/amtrak-fare-finder.client.ts   # thin APIRequestContext wrapper — the "Page Object" of the API layer
src/fixtures/api.fixtures.ts               # injects the client, same pattern as pom.fixtures.ts
```

Plus a `no-restricted-imports` guard for `tests/api/**` mirroring the POM guard, and an
`api` project in `playwright.config.ts` (`testMatch: /tests\/api\//`, no browser → runs
in ms). The station-autocomplete and `journey-solution-option` endpoints behind the
widget are the first candidates.

## 1. Another region of the same page → a new component object

The homepage has a global header, an alerts banner, a deals carousel. Each is a
component object added to `HomePage`:

```ts
// src/pages/components/global-header.component.ts
export class GlobalHeader extends BaseComponent {
  bookTab = (): Locator => this.page.getByRole('tab', { name: 'BOOK' });
  signInLink = (): Locator => this.page.getByRole('link', { name: /sign in/i });
}

// src/pages/home.page.ts
export class HomePage extends BasePage {
  readonly findTrainsForm = new FindTrainsForm(this.page);
  readonly header = new GlobalHeader(this.page);          // ← add
}
```

No fixture change, no spec change elsewhere.

## 2. Another page → a new Page Object + one fixture entry

```ts
// src/pages/search-results.page.ts
export class SearchResultsPage extends BasePage {
  results = (): Locator => this.page.getByRole('listitem').filter({ hasText: /depart/i });
  open = async (): Promise<void> => { await this.navigate('/dotcom/search-results'); };
}
```

```ts
// src/fixtures/pom.fixtures.ts
export interface PageObjects {
  homePage: HomePage;
  searchResultsPage: SearchResultsPage;   // ← add
}
export const test = base.extend<PageObjects>({
  homePage: async ({ page }, use) => { /* … */ },
  searchResultsPage: async ({ page }, use) => {
    await use(new SearchResultsPage(page));
  },
});
```

Then `test('…', async ({ homePage, searchResultsPage }) => { … })`. Guard 1 blocks any
other way in.

## 3. More test data → extend the Builder, add tables

`TripSearchBuilder` already centralises defaults. Widen coverage by driving it from a
table:

```ts
const cases = [
  { from: 'New York', to: 'Washington',   tripType: 'one-way' },
  { from: 'Boston',   to: 'Philadelphia', tripType: 'round-trip' },
] as const;

for (const c of cases) {
  test(`accepts ${c.tripType} ${c.from} → ${c.to}`, async ({ homePage }) => {
    const trip = TripSearchBuilder.aTrip().from(c.from).to(c.to)./* … */.build();
    await homePage.findTrainsForm.fillSearch(trip);
    await expect(homePage.findTrainsForm.findTrainsButton()).toHaveAttribute('aria-disabled', 'false');
  });
}
```

Move `STATIONS` to a JSON fixture when the list gets long; keep regex "expected option"
matchers next to each entry.

## 4. Faster + deterministic → the mock lane (built)

`playwright.config.ts` has three projects: `mocked-chromium` (the gate), `mocked-mobile`
(signal), and `live-chromium` (real site, non-blocking). The `mockAmtrakApi` fixture
option (`src/fixtures/pom.fixtures.ts`) turns on `page.route` stubbing of the station
autocomplete for the mocked projects, fed by a small captured catalog in
`src/support/mocks/`. That removed the network-latency flakes; `mocked-chromium` runs
green at **0 retries**.

Room to grow this lane:

- **Stub `journey-solution-option` with a canned solution set** so a future `@regression`
  lane can drive *past* the button and assert on rendered results — still with no live
  backend. (Today the submit tests only intercept the request to read its payload.)
- **Re-capture on drift**: the `live-chromium` project is what flags a changed payload
  shape; the fixtures in `src/support/mocks/` are then re-captured from a fresh live run.

## 5. More quality signals

| Signal | How |
| --- | --- |
| Accessibility | `@axe-core/playwright`; assert no serious/critical violations per component; a keyboard-only completion spec |
| Visual | `expect(locator).toHaveScreenshot()` on default / error / popover states, per project |
| Performance budget | assert the widget is interactive within N ms via `PerformanceObserver` / CDP |
| Contract | if the widget ships to Storybook, mount it in isolation and test there — seconds, not a full page load |

## 6. CI as it grows

- **Sharding**: `--shard=${i}/${n}` across matrix jobs when the suite gets big.
- **Two triggers**: `mocked` on every PR (must be green); `live-smoke` on a schedule from
  an allow-listed egress IP (allowed to skip).
- **Report hosting**: publish the Playwright HTML report to GitHub Pages / an artifact
  browser; upload `blob-report` and merge across shards.
- **Flake tracking**: keep `--reporter=blob` + `npx playwright merge-reports`; fail the
  build on new flakes, not pre-existing ones.

## What stays constant

The guard rules, the `BasePage` / component-object split, fixture injection, "locators in
Page Objects, assertions in specs", and the Builder. Those are what keep a 12-test suite
and a 1,200-test suite readable the same way.
