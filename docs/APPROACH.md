# Approach

## Scope

The homepage **"Find trains"** search form and its inputs, **up to and including the
"Find trains" button click** — no results page, no booking flow. All three bookable trip
types are covered (One-Way, Round-Trip, Multi-City). Not exhaustive by design; the point
is the approach and the framework.

The button is `aria-disabled` until the form is valid, so "the form is complete and
acceptable" is observable as the button enabling — tests assert on that gate, not on
error-message text (brittle across locales / experiments). The one "did the click do
something" check intercepts the single request the widget fires
(`POST /dotcom/journey-solution-option`), asserts its payload, and aborts it.

## What I tested and why — 12 tests, one spec file per form feature

| # | Test | Category | Why / key assertion |
| --- | --- | --- | --- |
| ST1 | Autocomplete lists matching stations while typing | edge | The From/To fields are the most complex inputs. Listbox visible; first real suggestion contains "New York". Runs **un-mocked** in every lane (it *is* the autocomplete's test). |
| ST2 | Autocomplete lists nothing for an unrecognized query | edge | Negative path — no crash, no false matches. Zero `(XXX)`-coded suggestions. Also un-mocked. |
| ST3 | Same station in From and To → button stays disabled | validation | A station-pair rule; contradictory input is rejected. |
| TT1 | Choosing Multi-City reshapes the form into a multi-leg builder | happy | Third trip type: per-leg From/To/Depart rows, Add/Remove Trip controls, no return date. (Round-Trip's reshape is exercised by SS3 — it can't fill a return date otherwise.) |
| DD1 | Past dates are disabled in the departure calendar | edge | Boundary on the date input — the "yesterday" day cell is `aria-disabled`. |
| PS1 | Child with no adult → "add an adult" requirement, Done disabled | validation | Business/safety rule. Asserts the real inline copy + the popover's "Done" is `disabled`. |
| PS2 | Add {2 adults + 2 children}, then Reset → single adult | edge | Reset must clear *all* selections back to the only valid minimum. |
| SS1 | Find trains stays disabled until From, To and date are set | validation | The primary validation contract, checked progressively from empty form to complete. |
| SS2–SS4 | Submit fires the search request with the entered trip — **one body, looped over `SUBMITTABLE_TRIP_TYPES`** (one-way / round-trip / multi-city) | happy | Intercept `journey-solution-option`; assert `journeyRequest.type` (`OW`/`RT`/`MC`) and, for **every leg**, origin / destination / depart date / passenger count (RT = outbound + reversed return; MC = the entered legs). Then abort. Trip data lives in `src/data/test-data.ts`, not the spec. |
| SS5 | The entered passenger mix reaches the request | happy | `TripSearchBuilder…withPassengers({ adults: 2, children: 1 })` → the intercepted leg carries 3 `passengers` with `initialType`s `["adult","adult","child"]`. Proves the traveler popover feeds the payload; exercises the Builder's `.withPassengers()`. |

"Group Travel" is a lead form, not a search — out of scope.

## Assumptions

- **In scope = the form only.** Anything the click navigates to is out of scope, so the
  happy path stops at "request fired / no error".
- **The disabled-button pattern is intentional validation** — Amtrak ships no inline
  "please fill this in" text for the empty form.
- **`amt-auto-test-id` attributes are stable-ish** — Amtrak adds them for automation. The
  few accessors with no usable test-id (the two date inputs; the ng-bootstrap calendar)
  fall back to `aria-labelledby` / a class union, tagged `// VERIFY:`.
- **No auth / test account / seeded data** needed. Pre-seeding OneTrust consent cookies is
  an acceptable way to get a clean form; it doesn't change what's under test.
- **Stations** (NYP, WAS, BOS, PHL) are permanent, high-traffic. **Dates** are computed
  relative to "today" so tests don't rot.

## Known risks / limitations

- **Live third-party site.** `amtrak.com` is behind Akamai bot management; from some IPs
  (datacenter, CI) the widget won't load. The **live** lane — and the two real-autocomplete
  tests — `test.skip()` with a reason. The **mocked** lanes have no bot wall to blame, so a
  non-ready widget there **fails** (selector drift / app change).
- **Autocomplete latency under parallelism.** The mocked lanes stub `getResponseList` for
  the tests that only *use* station selection. The real autocomplete (ST1/ST2 and the whole
  live lane) can lag or rate-limit under 4 workers — `PW_WORKERS=2 npm run test:live` eases
  it. `selectStationInto` types with `fill`, waits for the option list to settle, matches
  by 3-letter code, retries the click if the list rebuilds, falls back to keyboard
  selection, and verifies the commit (5 internal attempts, then a loud `throw`). One
  Playwright `retry` sits on top.
- **Selector drift.** Amtrak A/B-tests this widget; `// VERIFY:`-tagged locators are the
  ones to re-check with `npm run codegen`.

## What I'd do differently / next, with more time

- Stub `journey-solution-option` with a canned solution set so a future `@regression` lane
  can drive *past* the button and assert on rendered results with no live backend.
- Accessibility (`@axe-core/playwright`, keyboard-only completion), visual regression
  (`toHaveScreenshot` on default / error / popover states).
- Data-driven station/date matrices off `TripSearchBuilder`; component-contract tests if
  the widget ships to a Storybook harness.
- Locale variants (Español / Français) and their validation copy.
- CI: live lane on a schedule from an allow-listed egress IP; publish the HTML report.
- Coupon / promo-code and the swap (From ⇄ To) control — deferred as low-risk isolated
  inputs; each is a one-liner Page-Object addition.
