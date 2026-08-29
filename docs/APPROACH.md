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
| The same station in From and To leaves Find trains disabled | A station-pair rule — contradictory input is rejected. |

### `trip-type.spec.ts` — trip-type toggle

| Test | Why |
| --- | --- |
| Choosing Multi-City turns the form into a multi-leg builder | Covers the third bookable trip type: the form splits into per-leg From/To/Depart rows with Add/Remove Trip controls and no return date. Round-Trip's reshaping is exercised by the round-trip submit test (it can't fill a return date otherwise). |

All three bookable trip types are submitted end-to-request in `search-submission.spec.ts`
(one shared test body, looped over `SUBMITTABLE_TRIP_TYPES`). Multi-city is the
heaviest — four station selections and two calendars per run — so `fillLegs` waits for the
re-rendered leg rows to settle before it starts filling.

### `departure-date.spec.ts` — depart calendar

| Test | Why |
| --- | --- |
| Past dates are disabled in the departure calendar | Boundary on the date input — the day cell is `aria-disabled`. |

### `passenger-selection.spec.ts` — traveler popover

| Test | Why |
| --- | --- |
| A child with no adult shows the "add an adult" requirement and blocks Done | Business/safety rule — a minor cannot travel unaccompanied. Asserts the real inline copy and that the popover's "Done" is disabled. |
| Add {2 adults + 2 children}, then Reset returns the travelers to a single adult | Reset must clear *all* selections back to the only valid minimum (1 adult, 0 everyone else). The stepper feeding the outgoing request is covered by the passenger-mix test below. |

### `search-submission.spec.ts` — the "Find trains" button

Amtrak keeps the button `aria-disabled` until the form is valid, so "the form is complete
and acceptable" is itself observable as the button enabling — these tests assert on that
gate rather than on error-message text (brittle across locales / experiments).

| Test | Why |
| --- | --- |
| Find trains stays disabled until From, To and departure date are set | The primary validation contract, checked progressively from the empty form to a complete one. |
| Submit sends the journey-search request with the entered trip — **one test body, looped over `SUBMITTABLE_TRIP_TYPES` (one-way, round-trip, multi-city)** | The strongest in-scope signal that the click *did something*. `page.route` intercepts the one call the widget makes — `POST /dotcom/journey-solution-option` — asserts the POST body's `journeyRequest.type` (`OW`/`RT`/`MC`) and, for **every leg**, origin, destination, depart date and passenger count (round-trip = outbound + reversed return; multi-city = the entered legs), then **aborts** it. Trip types and the canonical per-type trip live in `src/data/test-data.ts`, not the spec. The click also navigates to `/tickets/departure.html`; out of scope, so we go no further. |
| The entered passenger mix is carried into the search request | `TripSearchBuilder.aTrip()…withPassengers({ adults: 2, children: 1 })`, submit, and assert the intercepted payload's leg has 3 `passengers` with `initialType`s `["adult","adult","child"]`. Proves the traveler popover feeds the request, and shows the Builder's `.withPassengers()` in a spec. |

## Assumptions

1. **In scope = the form only.** Anything the click navigates to is out of scope, so the
   happy path stops at "request fired / no error", not "results rendered".
2. **The disabled-button pattern is intentional validation.** Amtrak ships no inline
   "please fill this in" text for the empty form — the disabled CTA *is* the message.
3. **`amt-auto-test-id` attributes are stable-ish.** Amtrak adds them for automation;
   I prefer them over deep css. The few accessors with no usable test-id (the two date
   inputs — their test-ids are duplicated / mislabeled — and the ng-bootstrap calendar)
   fall back to `aria-labelledby` / a class union and are tagged `VERIFY:` in the Page
   Object.
4. **No auth, no test account, no seeded data** needed for this scope.
5. **Consent**: pre-seeding OneTrust cookies is an acceptable way to get a clean form.
   It doesn't change what's under test (the search widget).
6. **Stations used** (NYP, WAS, BOS, PHL) are permanent, high-traffic Amtrak stations
   unlikely to disappear.
7. **Dates** are computed relative to "today" (`departingInDays(14)`) so tests don't rot.

## Known risks / limitations

- **Live third-party site.** `amtrak.com` is behind Akamai bot management; from some IPs
  (datacenter, CI) the widget won't load. The **live** lane `test.skip()`s with a clear
  reason when that happens; the **mocked** lanes fail instead (no bot wall to blame — a
  non-ready widget there is a real regression). `global-setup.ts` logs a reachability
  probe for quick triage.
- **Autocomplete latency under parallelism.** The `mocked-*` projects stub
  `getResponseList` so the station lookup is instant; `mocked-chromium` runs green at 0
  retries. `live-chromium` still hits the real service, so it gets `retries: 2` and is
  not a gate. `selectStationInto` sets the query with `fill` (atomic), picks the option
  by 3-letter code scoped to that field's list, and verifies the commit (throws
  `"Could not commit station …"` after 4 tries); `fillLegs` waits for the Multi-City leg
  count to settle before filling.
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
