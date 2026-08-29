# Test plan — Amtrak "Find trains" form

## Scope boundary

| In scope | Out of scope |
| --- | --- |
| Homepage "Find trains" widget and its inputs | Search-results page |
| Trip type (One-Way / Round-Trip / Multi-City toggle) | Fare selection, seat maps, booking, payment |
| From / To station autocomplete | Account / sign-in, Guest Rewards |
| Depart / Return date pickers | Train status, schedules, other homepage modules |
| Passenger (traveler) selector | Rail passes, Auto Train, multi-city itinerary building |
| Coupon / promo code field | Anything the "Find trains" click navigates to |
| "Find trains" button state + the click itself | Back-end correctness of returned journeys |

"Up to and including the button click" — the happy path asserts the search **request is
issued** and no validation error is shown; it does not wait for or inspect results.

## Coverage matrix

Test type is a **tag** (mirrored by a `[type]` title prefix), not a folder. Two types
only: `@smoke` (non-mutating UI interaction — fill / click / toggle / assert state) and
`@regression` (the test proceeds past a boundary into the app). This suite stops at the
"Find trains" button click, so **all 19 tests are `@smoke`** and there are no
`@regression` tests — expected for the scope. See [FRAMEWORK.md](FRAMEWORK.md).

One spec file per feature of the form. All `@smoke`.

### Coverage against the brief's three categories

The brief asks for happy path / validation / edge cases. That is *intent*, not a tag —
here is where each lands:

| Category | Tests |
| --- | --- |
| **Happy path** | SS3 (one-way, no error), SS4–SS6 (one-way / round-trip / multi-city submit + payload), TT1/TT2 (round-trip + multi-city reshaping), ST3 (swap) |
| **Validation** | SS1, SS2 (required-field gating), ST4 (same station), PS2 (child needs an adult) |
| **Edge cases** | ST1, ST2 (autocomplete match / no-match), DD1 (past date), PS1/PS3/PS4 (passenger stepper, Reset, discount options), PC1 (coupon) |

All three bookable trip types are submitted end-to-request: **One-Way** (SS3 + SS4),
**Round-Trip** (TT1 + SS5), **Multi-City** (TT2 + SS6). "Group Travel" is a lead form,
not a search, so it is out of scope.

### `station-selection.spec.ts` — From / To inputs

| # | Test | Key assertion |
| --- | --- | --- |
| ST1 | Type "New York" in From | suggestion listbox visible; first real suggestion contains "New York" |
| ST2 | Type gibberish in From | zero suggestions carrying a `(XXX)` station code |
| ST3 | Swap control after picking both stations | `fromInput` now holds old To value and vice-versa |
| ST4 | Same station for From & To (+ valid date) | button stays `aria-disabled="true"` |

### `trip-type.spec.ts` — One-Way / Round-Trip toggle

| # | Test | Key assertion |
| --- | --- | --- |
| TT1 | Switch to Round-Trip | depart **and** return date fields both visible |
| TT2 | Switch to Multi-City | trip-type button reads "Multi-City"; "Add Trip" and "Remove Trip" controls visible; no return-date field (each leg is one-way) |

### `departure-date.spec.ts` — depart calendar

| # | Test | Key assertion |
| --- | --- | --- |
| DD1 | Past departure date | calendar day cell for "yesterday" is `aria-disabled` / not selectable (`isDateSelectable` → `false`) |

### `passenger-selection.spec.ts` — traveler popover

| # | Test | Key assertion |
| --- | --- | --- |
| PS1 | Stepper `+ Add adult` | traveler button count now shows 2 |
| PS2 | Add a child, remove the adult (0 adults) | inline message "Add at least one adult 18 years old or older."; popover "Done" is `disabled` |
| PS3 | Reset from {2 adults} and from {2 adults + 2 children} | traveler button `aria-label` back to `1 Traveler…`; Traveler 1 discount back to "Adult" |
| PS4 | Open the "Traveler 1" discount dropdown | options are exactly `Adult`, `Rail Passengers Association`, `Active US Military`, `Military Veteran` |

### `promo-code.spec.ts` — coupon field

| # | Test | Key assertion |
| --- | --- | --- |
| PC1 | Enter coupon code `V595` | coupon input `toHaveValue("V595")` |

### `search-submission.spec.ts` — the "Find trains" button

| # | Test | Key assertion |
| --- | --- | --- |
| SS1 | Empty form → complete form | `aria-disabled` goes `true` → `false` only once From + To + date are set |
| SS2 | Only From filled | button stays `aria-disabled="true"` |
| SS3 | Fully completed one-way search, then click | no validation error shown after the click |
| SS4–SS6 | Submit → click fires the search API — **parameterized over `SUBMITTABLE_TRIP_TYPES`** (one-way, round-trip, multi-city) | `page.route('**/dotcom/journey-solution-option')` is hit; captured POST body has the right `journeyRequest.type` (`OW`/`RT`/`MC`) and, for **every leg**, origin, destination, depart date and passenger count 1 (round-trip = outbound + reversed return; multi-city = NY→WAS then BOS→PHL). Request is **aborted** (results page out of scope). |

### API — `tests/api/find-trains/` (scaffold)

No tests yet — the assignment scope is the UI form. The directory and its README show
where request-level tests (station-autocomplete contract, `journey-solution-option`
validation) would land, tagged the same `@smoke` / `@regression` way.

## Environments

| | |
| --- | --- |
| Projects | `mocked-chromium` (1440×900, stubbed autocomplete — the gate), `mocked-mobile` (Pixel 7, bonus), `live-chromium` (real site, not a gate) |
| Base URL | `https://www.amtrak.com` (`BASE_URL` to override) |
| Parallelism | 4 workers, `fullyParallel` |
| Retries | 1 (mocked), 2 (`live-chromium`) |

## Not automated here (documented in [APPROACH.md](APPROACH.md) → *next steps*)

- Accessibility (axe) scan of the form and keyboard-only completion
- Visual regression of default / error / passenger-popover states
- Multi-City with 3+ legs (2-leg submit is covered by SS6)
- Locale variants (Español / Français) and their validation copy
- Deep passenger-mix rules (infant-on-lap ≤ adults, max party size, senior/youth age bands)
- "Add another traveler type" combinations beyond a single increment
