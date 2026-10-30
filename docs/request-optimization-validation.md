# Request optimization: implementation and validation

Implemented 30 October 2026. No deployment or real email sends were performed. No Firestore schema or rules changes are required.

## Changes

- Removed `saveProfile` from account connection setup and removed its unused implementation. The UI already reads the profile name from Firebase Auth. Reloading or retrying a workspace connection no longer writes a profile document.
- Account records hydrate from the validated per-user cache before a server snapshot arrives. Read-only views and filters remain usable while reconnecting. Cloud saves still require server synchronization and connectivity.
- Snapshot merges preserve object identity for metadata-only callbacks, ignore older/equal revisions, retain soft deletions, and keep timestamp nanoseconds and inclusive replay. Cache serialization is coalesced over 250 ms and flushed on page hiding, page exit, and cleanup. Records and the cursor remain in one atomic storage value.
- Long hidden intervals (five minutes) and offline recovery rebase the listener using only server-confirmed records. Rebase waits for pending saves; obsolete callbacks are ignored. Short online tab switches do not recreate the listener. A full-history refresh provides recovery from a stale cache and correctly persists an authoritative empty result.
- `public/_headers` grants one-year immutable caching to fingerprinted assets, revalidates HTML/SPA routes, and grants one-hour caching to stable icons. Email responses retain `no-store`.
- Optional pages, demo CSV, export helpers, and ZIP compression load on demand. Lazy pages have a loading state and a reload action if loading fails. The demo loader ignores canceled/unmounted requests.
- DM Sans WOFF2 Latin and extended Latin subsets are self-hosted and fingerprinted by Vite, with `font-display: swap`. The SIL license is in source and the public build. Other characters continue to use font fallbacks.
- Email PNGs use 2x desktop dimensions or 720×1280 mobile story dimensions. Downloads retain 3x desktop or 1080×1920 mobile dimensions. A bounded image cache avoids repeated rendering when the frozen content/styles/layout match.
- Failed email submissions retain the exact prepared request and operation UUID for the same data/year/recipient/palette/theme/layout. Resend receives the validated idempotency key. Changing the content or successfully completing a send starts a new operation. Only a digest, random ID, and timestamp are retained in sessionStorage; image payloads remain in memory. Provider deduplication lasts 24 hours, not indefinitely.
- Development-only cloud diagnostics expose counts without record content, account IDs, or email addresses. In a Vite dev browser console, use `await import('/src/lib/cloudStorage.ts').then(m => m.getCloudDiagnostics())`. `documentsDelivered` counts document changes in server callbacks, not Firebase billing totals.

## Measured local results

| Build output | Before | After (rounded) |
| --- | ---: | ---: |
| Main JS, raw | 2,178 kB | 1,461 kB |
| Main JS, gzip | 616.07 kB | 442 kB |
| Initial CSS, gzip | 26.78 kB | 22.46 kB |

The main JS download is approximately 28% smaller. These are build artifact measurements, not a production latency benchmark. The self-hosted Latin font adds a first-visit 36.93 kB font request, replacing the previous Google-hosted font request; it is not included in the JS comparison. Optional feature requests still occur when those features are opened.

In one desktop browser run using the 541-session demo, the nine email PNGs totaled 751,295 bytes versus 1,269,667 bytes for the high-resolution download PNGs (about 41% smaller). The mocked browser-to-email API JSON was 1,002,331 bytes. These figures vary with palette, viewport, and content; they are not a production average.

Cloudflare's local assets runtime returned the intended headers for `/`, `/index.html`, `/log`, `/sessions`, `/wrapped`, `/dev`, `/instructions`, and `/welcome`. Fingerprinted JS and WOFF2 returned `public, max-age=31536000, immutable`; the email route returned `no-store`. A second normal browser navigation showed zero transferred bytes for the main JS, CSS, and Latin font.

The installed Wrangler runtime supports compatibility dates only through 2026-05-03, while the existing deployment configuration uses 2026-10-09. Header checks used a **local CLI override** of `--compatibility-date 2026-05-03`. The deployment configuration was not changed. Repeat response-header checks after deployment with a current runtime.

## Automated checks

Required runtime: the project's supported Node version and installed dependencies. Standard commands:

```sh
npm run build
npm run lint
npm run test:requests
npm run test:accounts
node --test tests/*.test.mjs scripts/verify-training-journey.mjs
```

The full suite passed all 103 tests with `JOURNEY_VERIFY_CSV=demodata/gymdesk-all-attendance-2026-10-03.csv`. Without that environment variable, the optional CSV check skips. TypeScript and build passed. Lint completed without errors; existing React and unused-parameter warnings remain. The two server-rendered chart test loaders now stub the analytics boundary instead of trying to initialize browser Firebase inside Node.

The optional browser checks require an installed Playwright package and a Chromium browser. They do not add a runtime dependency to the application. If Playwright is outside this repository, set `PLAYWRIGHT_MODULE` to its absolute `index.js` path; set `TEST_BROWSER_PATH` to an installed Chrome/Edge executable if Playwright's own browser is unavailable.

```sh
# Run after a production build, from the repository root.
npm run test:requests:browser
```

The script starts local Vite preview/dev servers and closes them when finished. Browser artifacts go to ignored `node_modules/.tmp/request-optimization/`. Checks passed for:

- Optional chunks absent from initial overview; export code absent until an export action; no Google Fonts requests.
- Demo import, direct optional-page navigation, 3D page loading, and ZIP download.
- Actual desktop/mobile PNG rendering and identical request body/UUID after an immediate mocked timeout and retry. PNGs were visually inspected.
- Real React workspace hook with mocked account/transport boundaries: immediate hydration, metadata identity, rebasing from server-confirmed state, stale callback rejection, one active listener, pending-save coordination, empty full resync, and account switching.
- Node tests covering inclusive timestamps, deletion markers, cache quota failure/coalescing/isolation, transaction conflicts, provider retry headers/validation, and client retry expiration/storage failures.

Browser email requests and provider requests are mocked. No test emails were sent. The browser hook test is not a Firestore emulator test and cannot establish production listener billing or deployed security rules.

## Deliberately deferred and production follow-up

Persistent SDK caching/multi-tab sharing remains a later, evidence-dependent change. The app still owns a complete account snapshot, because an incremental Firestore query or evictable SDK cache cannot replace that complete history without redesign. Offline writes remain disabled because transactions require connectivity.

Inline email images plus separate downloadable attachments are preserved. Removing one copy needs email-client compatibility validation and a product decision. Multipart upload is also deferred; smaller PNGs reduce payload without introducing another request parser.

Before release, repeat account synchronization/conflict/deletion checks against a Firestore emulator or test accounts in two browsers, and verify deployed headers/new asset URLs after deployment. Capture Firebase read/write usage for cold/warm accounts and reconnects; local browser request counts and mocked snapshots do not prove production billing savings. No production percentage read/write reduction is claimed.
