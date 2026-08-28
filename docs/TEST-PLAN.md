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

### Happy path — `tests/find-trains/form-happy-path.spec.ts`

| # | Test | Key assertion | Tag |
| --- | --- | --- | --- |
| H1 | One-way, valid stations, depart +14d | button `aria-disabled="false"`, then no validation error after click | `@smoke` |
| H2 | Switching to Round-Trip reshapes the form | depart **and** return date fields both visible | |
| H3 | Valid search → "Find trains" fires `journey-solution-option` request | `page.waitForRequest` resolves | `@smoke` |
| H4 | Swap button reverses From/To | `fromInput` now holds old To value and vice-versa | |

### Validation — `tests/find-trains/form-validation.spec.ts`

| # | Test | Key assertion |
| --- | --- | --- |
| V1 | Empty form → complete form | `aria-disabled` goes `true` → `false` only once origin + destination + date are set |
| V2 | Only origin filled | button stays `aria-disabled="true"` |
| V3 | Same station for origin & destination (+ valid date) | button stays `aria-disabled="true"` |
| V4 | Past departure date | calendar day cell for "yesterday" is `aria-disabled` / not selectable (`isDateSelectable` → `false`) |

### Edge cases — `tests/find-trains/form-edge-cases.spec.ts`

| # | Test | Key assertion | Tag |
| --- | --- | --- | --- |
| E1 | Type "New York" in From | suggestion listbox visible; first real suggestion contains "New York" | `@edge` |
| E2 | Type gibberish in From | zero suggestions carrying a `(XXX)` station code | `@edge` |
| E3 | Passenger stepper `+ Add adult` | traveler button text now contains "2" | `@edge` |
| E4 | Enter coupon code `V595` | coupon input `toHaveValue("V595")` | `@edge` |

## Environments

| | |
| --- | --- |
| Browsers | Chromium, Firefox, WebKit (desktop 1440×900) + Pixel 7 (mobile) |
| Base URL | `https://www.amtrak.com` (`BASE_URL` to override) |
| Parallelism | 4 workers, `fullyParallel` |
| Retries | 1 local / 2 CI |

## Not automated here (documented in [APPROACH.md](APPROACH.md) → *next steps*)

- Accessibility (axe) scan of the form and keyboard-only completion
- Visual regression of default / error / passenger-popover states
- Multi-City trip building
- Locale variants (Español / Français) and their validation copy
- Deep passenger-mix rules (infant-on-lap ≤ adults, max party size, senior/youth age bands)
- "Add another traveler type" combinations beyond a single increment
