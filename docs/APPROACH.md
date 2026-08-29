## Scope (from the brief)

- Target: the homepage **"Find trains"** search form and its inputs.
- Boundary: **up to and including the "Find trains" button click.** No results page, no
  booking flow.  
- I included the multiple methods of finding trains - One way, Round trip, and Multi City.
- Not meant to be exhaustive — the point is to show testing approach and framework design.

## What I tested and why

One spec file per **feature of the form**, every assertion on the near side of the submit
click. Every test is non-mutating UI interaction (fill / click / toggle / assert state),
so every test is tagged `@smoke`; nothing here proceeds past the button into the app, so
nothing is `@regression`.

### `station-selection.spec.ts` — From / To inputs

| Test | Why |
| --- | --- |
| Autocomplete lists matching stations while the user types | The From/To fields are the most complex inputs on the form. |
| Autocomplete lists no station for an unrecognized query | Negative path — no crash, no false matches. |
| The swap control exchanges the From and To stations | Small, high-value interaction with a deterministic assertion (`toHaveValue`). |
| The same station in From and To leaves Find trains disabled | A station-pair rule — contradictory input is rejected. |

### `trip-type.spec.ts` — One-Way / Round-Trip toggle

| Test | Why |
| --- | --- |
| Choosing Round-Trip adds a return date field | Exercises the toggle and the form reshaping. |
| Choosing Multi-City turns the form into a multi-leg builder | Covers the third bookable trip type: the form splits into per-leg From/To/Depart rows with Add/Remove Trip controls and no return date. Kept to the reshaping assertion — a full multi-leg *submit* (4+ autocompletes, 2+ calendars) is the flakiest possible live-site test and belongs in the mock lane. |

All three bookable trip types are submitted end-to-request in `search-submission.spec.ts`
(one shared test body, looped over `SUBMITTABLE_TRIP_TYPES`). Multi-city is the
heaviest — four station autocompletes and two calendars per run — so it leans on the
retry more than the others; a mock lane would make it deterministic (see *Next steps*).

### `departure-date.spec.ts` — depart calendar

| Test | Why |
| --- | --- |
| Past dates are disabled in the departure calendar | Boundary on the date input — the day cell is `aria-disabled`. |

### `passenger-selection.spec.ts` — traveler popover

| Test | Why |
| --- | --- |
| Adding an adult increments the traveler count | The passenger selector is a multi-control popover; prove the plumbing works. |
| A child with no adult shows the "add an adult" requirement and blocks Done | Business/safety rule — a minor cannot travel unaccompanied. Asserts the real inline copy and that the popover's "Done" is disabled. |
| Reset returns the travelers to a single adult (from {2 adults} and {2 adults + 2 children}) | Parameterised over two combinations. Reset must clear *all* selections back to the only valid minimum (1 adult, 0 everyone else) and revert the discount. |
| The Traveler 1 discount dropdown offers the four passenger types | Locks the discount options to `Adult`, `Rail Passengers Association`, `Active US Military`, `Military Veteran` — a small, high-signal contract check. |

### `promo-code.spec.ts` — coupon field

| Test | Why |
| --- | --- |
| An entered coupon code stays in the field | The optional promo input is revealed on demand. |

### `search-submission.spec.ts` — the "Find trains" button

Amtrak keeps the button `aria-disabled` until the form is valid, so "the form is complete
and acceptable" is itself observable as the button enabling — these tests assert on that
gate rather than on error-message text (brittle across locales / experiments).

| Test | Why |
| --- | --- |
| Find trains stays disabled until From, To and departure date are set | The primary validation contract, checked progressively. |
| Find trains stays disabled when only From is set | Partial input must not be submittable. |
| A fully completed one-way search submits without a validation error | The core journey — the form can be completed and submitted cleanly. |
| Submit sends the journey-search request with the entered trip — **one test body, looped over `SUBMITTABLE_TRIP_TYPES` (one-way, round-trip, multi-city)** | The strongest in-scope signal that the click *did something*. `page.route` intercepts the one call the widget makes — `POST /dotcom/journey-solution-option` (identified by live network capture) — asserts the POST body's `journeyRequest.type` (`OW`/`RT`/`MC`) and, for **every leg**, origin, destination, depart date and passenger count (round-trip = outbound + reversed return; multi-city = the entered legs), then **aborts** it. Trip types and the canonical per-type trip live in `src/data/test-data.ts`, not the spec. The click also navigates to `/tickets/departure.html`; out of scope, so we go no further. |

## Assumptions

1. **In scope = the form only.** Anything the click navigates to is out of scope, so the
   happy path stops at "request fired / no error", not "results rendered".
2. **The disabled-button pattern is intentional validation.** Amtrak ships no inline
   "please fill this in" text for the empty form — the disabled CTA *is* the message.
3. **`amt-auto-test-id` attributes are stable-ish.** Amtrak adds them for automation;
   I prefer them over deep css. Where I had to fall back to `#am-form-field-control-N`
   (Angular-assigned ids) or css, the line is tagged `VERIFY:` in the Page Object.
4. **No auth, no test account, no seeded data** needed for this scope.
5. **Consent**: pre-seeding OneTrust cookies is an acceptable way to get a clean form.
   It doesn't change what's under test (the search widget).
6. **Stations used** (NYP, WAS, BOS, PHL) are permanent, high-traffic Amtrak stations
   unlikely to disappear.
7. **Dates** are computed relative to "today" (`departingInDays(14)`) so tests don't rot.

## Known risks / limitations

- **Live third-party site.** `amtrak.com` is behind Akamai bot management. From some IPs
  (datacenter, CI) the widget won't load at all. The suite handles this by
  **`test.skip()`-ing with a clear reason** (see `src/fixtures/pom.fixtures.ts`) rather
  than failing. `global-setup.ts` logs a reachability probe to make triage quick.
- **Autocomplete latency / render lag under parallelism.** The `mocked-*` projects stub
  `getResponseList`, so the station lookup is instant and the flake source is removed —
  `mocked-chromium` runs green at `retries: 1` (`npm run test:mocked`). The `live-chromium`
  project keeps hitting the real service and can still lag; it gets `retries: 2` and is
  not a gate. Page-Object mitigations that help both lanes: `waitUntilReady` gates every
  test on the trip-type selector + a station field being visible; `selectStation` picks
  the option **by 3-letter code** and verifies the commit against it (throws
  `"Could not commit station …"` after 4 tries rather than failing downstream);
  `fillLegs` waits for the multi-city rows to settle.
- **Selector drift.** Amtrak runs A/B experiments on this widget. `VERIFY:`-tagged
  locators are the ones to check first with `npm run codegen` if things break.

## What I'd do differently / next, with more time

1. **Mock lane — done.** `mocked-chromium` / `mocked-mobile` stub `getResponseList`
   (`src/support/mocks/`) so the fill flow is deterministic; `live-chromium` stays as the
   thin real-site check. Next step here: also stub `journey-solution-option` with a canned
   solution set so a future `@regression` lane could assert on rendered results without
   the real backend.
2. **Accessibility checks.** Add `@axe-core/playwright` and assert no serious violations
   on the search form; add explicit keyboard-only traversal of the whole form.
3. **Visual regression** on the widget (`toHaveScreenshot`) for the default, error, and
   passenger-popover states.
4. **Data-driven station/date matrices** — drive `TripSearchBuilder` from a table of
   (from, to, tripType, pax) rows to widen coverage cheaply.
5. **Component-contract tests** if the widget is also consumable in isolation (Storybook
   / a component harness) — much faster than full-page runs.
6. **Locale / currency variants** — the site offers Español/Français; the form copy and
   validation messages differ.
7. **CI hardening** — run the live lane on a schedule with an allow-listed egress IP, and
   the mock lane on every PR; publish the Playwright HTML report to Pages.
8. **`amt-auto-test-id` audit** — work with the app team to add stable hooks to the few
   controls that still need css (trip-type options, calendar nav), removing the `VERIFY:`
   markers.
