# Approach

This is the write-up the assignment asks for: **what I chose to test and why, what I
assumed, and what I'd do with more time.**

## Scope (from the brief)

- Target: the homepage **"Find trains"** search form and its inputs.
- Boundary: **up to and including the "Find trains" button click.** No results page, no
  booking flow.
- Not meant to be exhaustive — the point is to show testing approach and framework design.

## What I tested and why

I grouped the tests the way the brief frames coverage — **happy path / validation /
edge cases** — and kept every assertion on the near side of the submit click.

### Happy path (`form-happy-path.spec.ts`)

| Test | Why it matters |
| --- | --- |
| One-way search with valid stations + future date is accepted (`@smoke`) | The core journey. Proves the form can be completed and submitted without error. |
| Clicking "Find trains" issues the journey-search request (`@smoke`) | The strongest in-scope signal that the click *did something* — the widget fires `POST /dotcom/journey-solution-option`. We assert the request leaves; we deliberately don't follow it. |
| Switching to Round-Trip reveals depart **and** return date fields | Exercises the trip-type toggle and the form reshaping. Kept deterministic (no multi-date fill) on purpose — the full round-trip *submission* path is flaky against the live autocomplete under parallelism and belongs in the mock lane (see *Next steps*). |
| Swap button reverses From/To | Small, high-value interaction with an easy, deterministic assertion (`toHaveValue`). |

Amtrak keeps the **"Find trains" button `aria-disabled` until the form is valid**, so
"the form is complete and acceptable" is itself observable as the button enabling. The
happy-path tests assert `aria-disabled="false"` before clicking.

### Validation (`form-validation.spec.ts`)

Because submission is gated by the disabled button, the validation tests assert on that
gate rather than on error-message text (which is also brittle across locales/experiments):

| Test | Why |
| --- | --- |
| Button is disabled until origin **and** destination **and** date are provided | The primary validation contract, checked progressively. |
| Button stays disabled with only the origin filled | Partial input must not be submittable. |
| Same station for origin and destination keeps search disabled | Contradictory input is rejected. |
| A past departure date cannot be selected in the calendar | Boundary on the date input — the day cell is `aria-disabled`. |

### Edge cases (`form-edge-cases.spec.ts`)

| Test | Why |
| --- | --- |
| Autocomplete suggests matching stations while typing | The From/To fields are the most complex inputs on the form. |
| Autocomplete returns no real stations for gibberish | Negative path — no crash, no false matches. |
| Passenger stepper increases the traveler count | The passenger selector is a multi-control popover; prove the plumbing works. |
| Coupon field accepts and retains a code | The optional promo input is revealed on demand. |

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
- **Autocomplete latency under parallelism.** With 4 workers hitting the real station
  service at once, a suggestion response occasionally lags past the first attempt. Three
  mitigations: the Page Object retries the type-and-pick up to 3×; `expect` timeout is
  15 s; `retries` is 1 locally / 2 in CI. The round-trip happy path is the most
  interaction-heavy and is the one most likely to use its retry.
- **Selector drift.** Amtrak runs A/B experiments on this widget. `VERIFY:`-tagged
  locators are the ones to check first with `npm run codegen` if things break.

## What I'd do differently / next, with more time

1. **Network-mock mode.** Stub the station-autocomplete and `journey-solution-option`
   endpoints (`page.route`) so the form logic can be tested deterministically and fast,
   with the live run kept as a thin smoke lane. This removes ~all of the flakiness above.
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
