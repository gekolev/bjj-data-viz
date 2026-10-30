# Overview demo transition

The overview uses the same bordered settings panel and toggle in both empty and populated states. It starts expanded without training data, and automatically collapses when demo, imported, manual, rank, or account data becomes available. A successful demo switch or CSV upload also collapses an already-open panel, including re-uploading data with unchanged totals. Turning off demo data reopens the panel if no personal data remains. Users can manually open or close the panel in either state.

`OverviewSetup` keeps the controls mounted and measures their height before React commits the new layout.

GSAP animates the section height and bottom spacing over 620 ms, fading the setup content into/out of the settings panel. A short reveal applies only to visible overview headings, stat cards, and chart-row containers. Charts and text are not scaled. The demo toggle retains its header space so it stays under the pointer.

Interrupted transitions start from their current on-screen height. Resizing finishes the current layout transition and releases its fixed height. Animation styles and GSAP contexts are cleaned up on completion/unmount. See [GSAP context cleanup](https://gsap.com/docs/v3/GSAP/gsap.context()/).

The settings button exposes `aria-expanded` and `aria-controls`. Closed content is inert and hidden after its fade. If focus was inside automatically closed content, it moves to the settings button. `prefers-reduced-motion: reduce` applies the final layout immediately and skips the card reveal.

## Metric count-ups and mobile navigation

The numeric card values count from zero with GSAP when they first mount with data or their target changes: total sessions, mat hours/minutes, sessions this month, average session duration, and Gi/No-Gi totals. A paused tween starts on the next animation frame so a heavy data render does not skip the initial zero. Updates change only the displayed text node, not React dashboard state. Unrelated settings changes do not restart the counters; changed targets cancel the old tween. Reduced motion shows final values immediately.

An invisible final-value sizing span reserves the number's width, with extra room for minutes/average duration. Screen readers receive the final value once, while intermediate visual values are hidden from accessibility APIs. Mat minutes now use a 60-minute remainder, correcting the previous `% 66` calculation, and totals are rounded to the nearest minute before splitting hours/minutes. The demo totals are 541 sessions and 577 h 50 m.

The six mobile navigation items now use an auto-column grid with a single row. Labels stay on one line, and the 69 px base height plus bottom safe-area inset is shared with content and sticky-form spacing.

## Verification

Production build and TypeScript checks pass. Lint reports no errors. Browser checks at 1440, 1024, 390, and 320 px verify intermediate animation heights, stable scroll/toggle position, preserved controls/cards, keyboard expansion, rapid reversal, resize cleanup, reduced motion, and no horizontal overflow. They also check zero/intermediate/final count-up values, stable number widths, no restarts on settings changes, CSV replacement during counting, and all six mobile navigation buttons fitting on one row with at least 44 px touch targets. Desktop/mobile screenshots were visually inspected.

After building, run `npm run test:overview:browser`. It uses the same optional installed Playwright and Chromium setup as [the request optimization browser checks](request-optimization-validation.md). Screenshots are written to ignored `node_modules/.tmp/overview-transition/`.
