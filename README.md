# Amtrak "Find trains" — E2E test suite

Playwright + TypeScript automated tests for the **"Find trains"** search form on
[amtrak.com/home](https://www.amtrak.com/home).

> Senior SDET take-home. Scope is the homepage search form and its inputs, **up to and
> including the "Find trains" button click** — no results page, no booking flow.

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

# 2. Install the Playwright browsers (Chromium, Firefox, WebKit)
npm run install:browsers
```

No environment variables, credentials, or `.env` file are required — the assignment
scope does not include login. Optional overrides:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `https://www.amtrak.com` | Point the suite at a different host/mirror |
| `PW_WORKERS` | `4` | Override the parallel worker count |
| `CI` | – | When set: 2 retries, `forbidOnly`, HTML report not opened |

## Running the tests

```bash
npm test                    # full suite, 4 parallel workers, all projects
npm run test:chromium       # Chromium only (fastest feedback)
npm run test:smoke          # @smoke-tagged tests only
npm run test:headed         # watch it drive a real browser
npm run test:ui             # Playwright's interactive UI mode
npm run report              # open the HTML report from the last run
```

Quality gates (also run in CI):

```bash
npm run lint                # ESLint incl. the framework guard rules
npm run typecheck           # tsc --noEmit
npm run check               # lint + typecheck
```

## Project layout

```
.
├── playwright.config.ts        # 4 workers, fullyParallel, projects, reporters, global-setup
├── eslint.config.mjs           # flat config + the two framework guard rules
├── eslint-rules/
│   └── pom-plugin.mjs          # custom rule: no raw locators / no `new *Page()` in tests
├── src/
│   ├── data/
│   │   └── test-data.ts        # stations, passenger defaults, TripSearchBuilder (Builder pattern)
│   ├── fixtures/
│   │   └── pom.fixtures.ts     # fixture-based Page Object injection + graceful skip
│   ├── support/
│   │   └── consent.ts          # OneTrust cookie pre-seed
│   └── pages/
│       ├── base.page.ts        # shared BasePage (arrow-fn locators, navigation, no assertions)
│       ├── home.page.ts        # HomePage — owns the FindTrainsForm component
│       └── components/
│           ├── base.component.ts
│           └── find-trains-form.component.ts   # the search widget (component object)
├── tests/
│   ├── _support/global-setup.ts               # one reachability probe (non-fatal)
│   └── find-trains/
│       ├── form-happy-path.spec.ts
│       ├── form-validation.spec.ts
│       └── form-edge-cases.spec.ts
└── docs/
    ├── APPROACH.md             # what was tested & why, assumptions, next steps  ← start here
    ├── FRAMEWORK.md            # architecture, patterns, the guard rules, conventions
    ├── TEST-PLAN.md            # enumerated test cases and the scope boundary
    └── SCALABILITY.md          # how this grows to cover more of amtrak.com
```

## How it's wired (30-second tour)

- **Page Object Model** with a shared [`BasePage`](src/pages/base.page.ts). The search
  widget is a **component object**, [`FindTrainsForm`](src/pages/components/find-trains-form.component.ts),
  owned by [`HomePage`](src/pages/home.page.ts).
- **Fixture-based injection** — specs pull `homePage` straight from the test callback;
  they never call `new HomePage()`. See [`pom.fixtures.ts`](src/fixtures/pom.fixtures.ts).
- **Locators live in Page Objects**, as arrow-function properties, following
  `getByRole` → `getByLabel` → `.locator` → css (with `amt-auto-test-id` hooks where
  Amtrak provides them). **Assertions live only in specs.**
- **Two enforced guards** (`npm run lint`):
  1. a raw locator (`page.getByRole(...)`, `.locator(...)`, …) or `new SomethingPage()`
     in a `*.spec.ts` fails lint — you must add the locator to a Page Object and inject it;
  2. `expect(...)` inside `src/pages/**` fails lint — assertions belong in tests.
- **Builder pattern** for test data: `TripSearchBuilder.aTrip().roundTrip().from(...).build()`.

Full rationale in [docs/FRAMEWORK.md](docs/FRAMEWORK.md).

## Continuous integration

[`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) runs `lint` +
`typecheck`, then the suite across Chromium / Firefox / WebKit in a matrix, and uploads
the HTML report as an artifact.

## Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| Every test **skips** with "widget did not load" | amtrak.com is behind Akamai bot management and blocked this run (common from datacenter/CI IPs). Re-run, or run locally. The suite skips instead of failing red — this is by design. |
| A `@smoke` happy-path test is **flaky** | The live station-autocomplete is network-bound; under 4 parallel workers a response occasionally lags. One local retry (`retries: 1`) normally absorbs it. See [docs/APPROACH.md](docs/APPROACH.md) → *Known risks*. |
| Selectors suddenly break | Amtrak reworked the widget. Re-inspect with `npm run codegen` and update the `VERIFY:`-tagged locators in [`find-trains-form.component.ts`](src/pages/components/find-trains-form.component.ts). |
| OneTrust cookie banner blocks clicks | Handled by [`src/support/consent.ts`](src/support/consent.ts) (cookie pre-seed) + a fallback click in `BasePage`. If Amtrak changes the CMP, update those. |
