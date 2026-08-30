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

## What I tested and why

Twelve tests, one spec file per form feature, all under `tests/ui/find-trains/`. The test
title is the identifier — it's what shows up in the runner. Grouped below by spec file.

### `station-selection.spec.ts`

| Test | Type | Why / key assertion |
| --- | --- | --- |
| Autocomplete lists matching stations while typing | edge | The From/To fields are the most complex inputs. Listbox visible; first real suggestion contains "New York". Runs **un-mocked** in every lane — it *is* the autocomplete's test. |
| Autocomplete lists nothing for an unrecognized query | edge | Negative path — no crash, no false matches. Zero `(XXX)`-coded suggestions. Also un-mocked. |
| Same station in From and To → button stays disabled | validation | A station-pair rule; contradictory input is rejected. |

### `trip-type.spec.ts`

| Test | Type | Why / key assertion |
| --- | --- | --- |
| Choosing Multi-City reshapes the form into a multi-leg builder | happy | Third trip type: per-leg From/To/Depart rows, Add/Remove Trip controls, no return date. (Round-Trip's reshape is exercised by the round-trip submit test — it can't fill a return date otherwise.) |

### `departure-date.spec.ts`

| Test | Type | Why / key assertion |
| --- | --- | --- |
| Past dates are disabled in the departure calendar | edge | Boundary on the date input — the "yesterday" day cell is `aria-disabled`. |

### `passenger-selection.spec.ts`

| Test | Type | Why / key assertion |
| --- | --- | --- |
| Child with no adult → "add an adult" requirement, Done disabled | validation | Business/safety rule. Asserts the real inline copy + the popover's "Done" is `disabled`. |
| Add {2 adults + 2 children}, then Reset → single adult | edge | Reset must clear *all* selections back to the only valid minimum. |

### `search-submission.spec.ts`

| Test | Type | Why / key assertion |
| --- | --- | --- |
| Find trains stays disabled until From, To and date are set | validation | The primary validation contract, checked progressively from empty form to complete. |
| Submit fires the search request with the entered trip — **one body, looped over `SUBMITTABLE_TRIP_TYPES`** (one-way / round-trip / multi-city) | happy | Intercept `journey-solution-option`; assert `journeyRequest.type` (`OW`/`RT`/`MC`) and, for **every leg**, origin / destination / depart date / passenger count (RT = outbound + reversed return; MC = the entered legs). Then abort. Trip data lives in `src/data/test-data.ts`, not the spec. |
| The entered passenger mix reaches the request | happy | `TripSearchBuilder…withPassengers({ adults: 2, children: 1 })` → the intercepted leg carries 3 `passengers` with `initialType`s `["adult","adult","child"]`. Proves the traveler popover feeds the payload; exercises the Builder's `.withPassengers()`. |

"Group Travel" is a lead form, not a search — out of scope.

## Assumptions

- **In scope = the form only.** Anything the click navigates to is out of scope, so the
  happy path stops at "request fired / no error".
- **The disabled-button pattern is intentional validation** — Amtrak ships no inline
  "please fill this in" text for the empty form, so the disabled CTA *is* the message.
- **No auth / test account / seeded data** needed. Pre-seeding OneTrust consent cookies is
  an acceptable way to get a clean form; it doesn't change what's under test.
- **Stations** (NYP, WAS, BOS, PHL) are permanent, high-traffic. **Dates** are computed
  relative to "today" so tests don't rot.
- Locator, lane and resilience decisions are in [FRAMEWORK.md](FRAMEWORK.md); this section
  is only the test-design assumptions.

## Known risks / limitations

- **Bot-walled third-party site.** From datacenter / CI IPs the widget sometimes won't
  load. The live lane (and the two real-autocomplete tests) `test.skip()` with a reason;
  the mocked lanes **fail** instead — see [FRAMEWORK.md](FRAMEWORK.md) → *Resilience*.
- **Real-autocomplete latency.** The two autocomplete tests and the whole live lane hit
  the real `getResponseList`, which can lag under 4 workers (`PW_WORKERS=2 npm run test:live`
  eases it). `selectStationInto` absorbs this with an internal retry + one Playwright
  retry — mechanism in [FRAMEWORK.md](FRAMEWORK.md) → *Conventions*.
- **Selector drift.** Amtrak A/B-tests this widget; `// VERIFY:`-tagged locators are the
  ones to re-check with `npm run codegen`.

## What I'd do differently / next, with more time

- **Drive past the button** into a `@regression` lane that asserts on the rendered Select
  Train page (the biggest gap in a suite that stops at the click) — see
  [FRAMEWORK.md](FRAMEWORK.md) → *Scaling* for the stub-and-drive mechanism.
- **Cover the deferred inputs** — coupon / promo-code, the swap (From ⇄ To) control, the
  "Traveler N" discount dropdown option list. Each is a one-liner Page-Object addition,
  left out only to keep the suite at ~12 tests.
- **Accessibility** — an axe scan of the form and a keyboard-only completion spec.
- **Locale copy** — the Español / Français variants have different validation strings.

(Broader framework growth — API layer, sharding, visual/perf signals — is in
[FRAMEWORK.md](FRAMEWORK.md) → *Scaling*.)
