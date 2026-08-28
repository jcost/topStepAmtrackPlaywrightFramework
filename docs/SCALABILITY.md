# Scaling this framework

The brief asks to show how the framework grows to cover more of amtrak.com. Here's the
path, cheapest first.

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
  { from: 'New York', to: 'Washington', tripType: 'one-way' },
  { from: 'Chicago',  to: 'Boston',     tripType: 'round-trip' },
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

## 4. Faster + deterministic → a mock lane

Split into two projects:

```ts
// playwright.config.ts
projects: [
  { name: 'live-smoke', testMatch: /@smoke/, use: { baseURL: 'https://www.amtrak.com' } },
  { name: 'mocked',     use: { baseURL: 'https://www.amtrak.com' /* + route stubs */ } },
]
```

A `mockAmtrak` fixture uses `page.route()` to serve canned station-autocomplete and
`journey-solution-option` payloads. The full functional suite runs against `mocked`
(fast, no bot wall, no flake); `live-smoke` stays as the thin "the real site still works"
check. This removes essentially all of the flakiness in
[APPROACH.md](APPROACH.md) → *Known risks*.

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
