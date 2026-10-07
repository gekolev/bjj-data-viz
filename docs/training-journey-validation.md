# Time on the mat: calculation audit

Reviewed 4 October 2026. Scope: the new Overview chart and the import transformations it consumes.

## Definitions

- One parsed attendance row is one session. Rank rows are excluded from session totals.
- Calendar months, distinct training days, and time-of-day groups use the browser's local calendar, consistent with the rest of the app. Numeric attendance and promotion dates use day/month/year. ISO date-only attendance is parsed as a local calendar date.
- In Sessions mode, a monthly style subtotal is the number of attendance records with that allocated style. In Hours mode, it is their total minutes divided by 60. The two style ratios can legitimately differ.
- Style proportions are monthly style subtotal divided by monthly total. Bars include Other where no style allocation is possible. A zero-total month has no defined ratio.
- Cumulative totals sum all preceding months, including the selected month. Hours are converted after summing minutes. Missing months contribute zero logged activity; this does not establish that no training took place.
- The calendar includes the earliest and latest attendance or rank record, inclusively. A diamond represents a month with ranks, colored by its final recorded rank; the detail panel lists every exact date and discipline. Rank records never add training hours.
- Coach, class, venue, and time-of-day counts each partition the selected month's attendance records. Training days count distinct local dates, so multiple sessions on a day count once.

## Estimation policy retained

Unlabeled sessions are allocated by the existing full-history known Gi/No-Gi **session-count** ratio, with cumulative rounding. Estimated monthly styles are not evidence of the actual historical monthly mix. Hours still use each assigned session's own duration. No known styles means unknown records remain Other.

Missing durations retain the app's existing 60-minute default and are now explicitly labeled as estimated. Date-only attendance is now shown under unrecorded times, rather than counted as morning training. Older saved records lack these metadata flags; reimport is required to identify those cases reliably and apply corrected date/duration parsing.

## Fixes and checks

- Corrected decimal minutes and plain numeric duration fields; supported compact `1h10m` durations.
- Corrected ambiguous numeric attendance dates to day/month/year and local ISO date-only dates; reject invalid calendar dates and negative durations.
- Separated the pure monthly calculation from the chart so it can be checked independently.
- Sorted rank records within months, clarified monthly marker granularity, fixed React SVG tooltip text, and added cumulative points so a single-month total is visible.
- `npm run test:journey`: 15 tests covering weighted ratios, month/year edges, leap days, invalid input, style allocation, unknown styles, empty/rank-only data, actual Gymdesk CSV header layout, local-storage persistence, and rendered totals/breakdowns/uncertainty notes. Every monthly style subtotal and cumulative value is independently reconciled for a 250-record, five-year fixture.
- Tests run under `Europe/Sofia`, `UTC`, and `America/Los_Angeles`. TypeScript and production build pass. Lint reports only existing warnings outside the new helpers/chart.

## Limits

The subsequently supplied `gymdesk-all-attendance-2026-10-03.csv` was checked against independent extraction of its source hours and minutes: all 541 attendance rows across 38 active months have recorded times, and every monthly time group matches for both fresh and legacy imports. September 2026 has 5 morning and 17 evening sessions. The legacy metadata compatibility bug is corrected: non-midnight timestamps are usable without a new flag; explicitly missing times and ambiguous legacy midnight timestamps remain unverified. All 17 tests pass when the source path is supplied through `JOURNEY_VERIFY_CSV`.

This does not verify the CSV's completeness or duplication against Gymdesk itself. Browser surfaces were unavailable: React-generated markup was checked, but visual layout and live pointer/keyboard/toggle behavior were not observed.
