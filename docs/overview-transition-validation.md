# Overview demo transition

The empty overview previously replaced its expanded setup controls with a closed `<details>` when demo data arrived. The dashboard moved immediately by the full height difference. The new `OverviewSetup` keeps the controls mounted and measures their height before React commits the new layout.

GSAP animates the section height and bottom spacing over 620 ms, fading the setup content into/out of the settings panel. A short reveal applies only to visible overview headings, stat cards, and chart-row containers. Charts and text are not scaled. The demo toggle retains its header space so it stays under the pointer.

Interrupted transitions start from their current on-screen height. Resizing finishes the current layout transition and releases its fixed height. Animation styles and GSAP contexts are cleaned up on completion/unmount. See [GSAP context cleanup](https://gsap.com/docs/v3/GSAP/gsap.context()/).

The settings button exposes `aria-expanded` and `aria-controls`. Closed content is inert and hidden after its fade. If focus was inside automatically closed content, it moves to the settings button. `prefers-reduced-motion: reduce` applies the final layout immediately and skips the card reveal.

## Verification

Production build and TypeScript checks pass. Lint reports no errors. Browser checks at 1440, 1024, 390, and 320 px verify intermediate animation heights, stable scroll/toggle position, preserved controls/cards, keyboard expansion, rapid reversal, resize cleanup, reduced motion, and no horizontal overflow. Desktop/mobile screenshots were visually inspected.

After building, run `npm run test:overview:browser`. It uses the same optional installed Playwright and Chromium setup as [the request optimization browser checks](request-optimization-validation.md). Screenshots are written to ignored `node_modules/.tmp/overview-transition/`.
