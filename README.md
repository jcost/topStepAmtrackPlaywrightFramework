# Amtrak "Find trains" — Playwright UI automation test suite

Playwright + TypeScript automated tests for the **"Find trains"** search form on
[amtrak.com/home](https://www.amtrak.com/home).

> Senior SDET take-home. Scope is the homepage search form and its inputs, **up to and
> including the "Find trains" button click** — no results page, no booking flow.

**Reviewer path:** this README to run it, then [docs/APPROACH.md](docs/APPROACH.md) for
what was tested and why. [docs/FRAMEWORK.md](docs/FRAMEWORK.md) (architecture, guard rules,
scaling) is deeper reference, not required reading.

---

## Requirements

| Tool | Version |
| --- | --- |
| Node.js | 20 LTS or newer (`.nvmrc` pins 22) |
| npm | 10+ (ships with Node) |
| OS | macOS / Linux / Windows |

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Install the Playwright browser (Chromium — every project uses the Chromium engine)
npm run install:browsers
```

No environment variables, credentials, or `.env` file are required — the assignment
scope does not include login. Optional overrides:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `https://www.amtrak.com` | Point the suite at a different host/mirror |
| `PW_WORKERS` | `4` | Override the parallel worker count |
| `CI` | – | When set: `forbidOnly`, HTML report not opened |

## Running the tests

**Just run this** — the full suite, one browser (Chromium desktop), ~30 seconds:

```bash
npm test
```

That's `mocked-chromium`: all 12 tests, 1 retry. It's the whole assignment's scope —
you don't need to run anything else to evaluate the submission.

<details>
<summary>Optional extra lanes</summary>

```bash
npm run test:mobile   # the same 12 tests on a Pixel 7 viewport (Chromium engine)
npm run test:live     # the same 12 tests against the REAL amtrak.com (nothing stubbed)
npm run test:mocked   # mocked-chromium + mocked-mobile together
npm run test:all      # every project (mocked-chromium + mocked-mobile + live-chromium)
npm run test:smoke    # --grep @smoke on mocked-chromium (today: identical to `npm test`)
npm run test:headed   # watch mocked-chromium drive a visible browser
npm run test:ui       # Playwright's interactive UI mode
npm run report        # open the HTML report from the last run
```

</details>

**One thing is stubbed: the station-autocomplete network call** (`src/support/mocks/`) — but
only for the tests that use station selection as a *precondition*, so their fill flow
doesn't depend on that third-party service's latency. The two tests that *are* about the
autocomplete (`station-selection.spec.ts` → "against the real autocomplete") run
un-stubbed **even in `npm test`**, and `test.skip` with a reason if Akamai blocks them.
Everything else runs for real regardless — typing, option rendering, value commit,
`aria-disabled` validation, the trip-type / calendar / traveler behaviour, and the
outgoing `journey-solution-option` payload. `npm run test:live` re-runs the **identical
12 specs** with the station lookup unstubbed too — every spec hits the real autocomplete.
See [docs/FRAMEWORK.md](docs/FRAMEWORK.md) → *The three projects / two lanes*.

**Location is folders, test type is tags.** `tests/ui/<domain>/` says *where* a test runs
and *what* it covers — one domain here, `find-trains`. The type is a Playwright tag, two
values: `@smoke` (non-mutating UI interaction) and `@regression` (proceeds past a boundary
into the app). This suite stops at the "Find trains" button click, so every test is
`@smoke`; `@regression` and a sibling `tests/api/` layer are where growth lands
([docs/FRAMEWORK.md](docs/FRAMEWORK.md) → *Scaling*). `--grep @smoke` slices across every
domain at once.

Quality gates (also run in CI):

```bash
npm run lint                # ESLint incl. the framework guard rules
npm run typecheck           # tsc --noEmit
npm run check               # lint + typecheck
```

## Project layout

```
.
├── playwright.config.ts        # projects (2 mocked + 1 live), retries, reporters, global-setup
├── eslint.config.mjs           # flat config + the two framework guard rules
├── eslint-rules/
│   └── pom-plugin.mjs          # custom rule: no raw locators / no `new *Page()` in tests
├── src/
│   ├── data/
│   │   └── test-data.ts        # stations, passenger defaults, TripSearchBuilder (Builder pattern)
│   ├── fixtures/
│   │   └── pom.fixtures.ts     # fixture-based Page Object injection + graceful skip
│   ├── support/
│   │   ├── consent.ts          # OneTrust cookie pre-seed
│   │   ├── journey-search.ts   # the search API endpoint + a pure reader for its request body
│   │   └── mocks/              # mock lane: canned station catalog + the page.route stub
│   └── pages/
│       ├── base.page.ts        # shared BasePage (arrow-fn locators, navigation, no assertions)
│       ├── home.page.ts        # HomePage — owns the FindTrainsForm component
│       └── components/
│           ├── base.component.ts
│           └── find-trains-form.component.ts   # the search widget (component object)
├── tests/
│   ├── _support/global-setup.ts               # one reachability probe (non-fatal)
│   └── ui/find-trains/                        # browser-driven specs, one file per form feature
│       ├── station-selection.spec.ts         # From/To autocomplete, same-station rule
│       ├── trip-type.spec.ts                 # Multi-City reshaping
│       ├── departure-date.spec.ts            # depart calendar constraints
│       ├── passenger-selection.spec.ts       # traveler popover + steppers
│       └── search-submission.spec.ts         # Find trains button gating + firing the request
└── docs/
    ├── APPROACH.md             # what was tested & why, the 12-test matrix, assumptions  ← start here
    └── FRAMEWORK.md            # architecture, guard rules, config, scaling  (deeper reference)
```

## How it's wired (30-second tour)

- **Page Object Model** with a shared [`BasePage`](src/pages/base.page.ts). The search
  widget is a **component object**, [`FindTrainsForm`](src/pages/components/find-trains-form.component.ts),
  owned by [`HomePage`](src/pages/home.page.ts).
- **Fixture-based injection** — specs pull `homePage` straight from the test callback;
  they never call `new HomePage()`. See [`pom.fixtures.ts`](src/fixtures/pom.fixtures.ts).
- **Locators live in Page Objects**, as arrow-function properties, preferring Amtrak's
  `amt-auto-test-id` automation hooks, then `getByRole` → `getByLabel` → stable `id` → css.
  **Assertions live only in specs.**
- **Two enforced guards** (`npm run lint`):
  1. a raw locator (`page.getByRole(...)`, `.locator(...)`, …) or `new SomethingPage()`
     in a `*.spec.ts` fails lint — you must add the locator to a Page Object and inject it;
  2. `expect(...)` inside `src/pages/**` fails lint — assertions belong in tests.
- **Builder pattern** for test data: `TripSearchBuilder.aTrip().roundTrip().from(...).build()`.

Full rationale in [docs/FRAMEWORK.md](docs/FRAMEWORK.md).

## Continuous integration

[`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) runs `lint` +
`typecheck`, then `npm test` (the `e2e-chromium` gate) with `test:mobile` and `test:live`
as non-blocking signal jobs, and uploads each HTML report as an artifact.

## Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| `live-chromium` tests **skip** with "widget did not load" | amtrak.com is behind Akamai bot management and blocked this run (common from datacenter/CI IPs). Re-run, or run locally. The live lane skips instead of failing red — by design. The mocked lanes have no bot wall to blame, so they **fail** instead of skipping. |
| A test is **flaky** in `mocked-chromium` | It runs at 1 retry, and the station fill retries internally on top of that — a flake that survives both is a real defect, don't ignore it. A stuck fill throws "Could not commit station …"; if the autocomplete option genuinely isn't rendering, re-capture the mock fixtures (`src/support/mocks/`) against the live payload. Flakes in `live-chromium` are expected and non-blocking. See [docs/APPROACH.md](docs/APPROACH.md) → *Known risks*. |
| Selectors suddenly break | Amtrak reworked the widget. Re-inspect with `npm run codegen` and update the `VERIFY:`-tagged locators in [`find-trains-form.component.ts`](src/pages/components/find-trains-form.component.ts). |
| OneTrust cookie banner blocks clicks | Handled by [`src/support/consent.ts`](src/support/consent.ts) (cookie pre-seed) + a fallback click in `BasePage`. If Amtrak changes the CMP, update those. |
