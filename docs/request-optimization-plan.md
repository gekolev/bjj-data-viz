# Request and caching optimization plan

Reviewed: 30 October 2026. Scope: code review of the Vite/React frontend, Firebase account storage, and Cloudflare email Worker. No production traffic capture or billing data was available; expected benefits below are hypotheses to validate, not measured savings.

Implementation: steps 1–6 are now implemented, with a local build baseline and browser integration checks. Conditional changes such as persistent Firestore caching, multipart uploads, and removing duplicate email attachments remain deferred. See [results and validation](request-optimization-validation.md) for measured bundle changes, test commands, and remaining production checks. The sections below preserve the implementation rationale.

## What already works well

- `src/lib/cloudStorage.ts` stores account records under a per-user localStorage key and uses an inclusive `updatedAt >= latestCachedTimestamp` query on subsequent subscriptions. Reloads with a healthy cache already avoid fetching the entire history.
- `src/lib/cloudModel.ts` generates changes only for changed records. Reimporting identical data under the same filename already avoids record writes. Soft deletion markers let other devices learn about deletions.
- `useTrainingWorkspace()` is called once in `App`; normal internal navigation does not recreate it. There is no polling loop to eliminate.
- Filtering and chart aggregation happen locally, with substantial existing `useMemo` coverage. Changing a year or style should not issue database queries.
- Static assets use Cloudflare's assets binding. Email responses already use `Cache-Control: no-store`; analytics is dynamically imported and disabled locally.

## Implementation order

| Order | Change | Expected benefit | Scope |
| --- | --- | --- | --- |
| 0 | Establish a production-build baseline | Prove which requests/reads matter | Small |
| 1 | Remove connection-triggered profile writes | Fewer Firestore writes | Small |
| 2 | Render and maintain the account cache properly | Faster repeat visits, less storage/CPU work | Medium |
| 3 | Add explicit caching for fingerprinted assets | Fewer repeat asset transfers and revalidation requests | Small |
| 4 | Load optional features on demand | Smaller initial JS download | Medium |
| 5 | Refresh the incremental listener at safe boundaries | Bound rereads on reconnect | Medium |
| 6 | Make email retries idempotent and reduce image payloads | Fewer duplicate sends, fewer uploaded bytes | Medium |
| Later | Evaluate persistent Firestore caching and multi-tab coordination | Potentially reduce duplicate tab/reconnect work | Medium; evidence-dependent |

## 0. Record a baseline

Use a production build, not Vite development mode. React StrictMode can replay effects in development and distort connection/write counts.

Capture browser Network traces with the browser cache enabled for: guest cold visit; verified account with empty cache; warm account reload; navigation through all pages; unchanged CSV reimport; one manual edit; two tabs; offline/reconnect; Wrapped email retry with a mocked provider. Use test accounts with approximately 100, 1,000, and 10,000 records.

Record compressed initial JS/CSS bytes, transferred asset bytes on warm reload, time until cached history appears, listener starts/stops, documents returned per server snapshot, transaction attempts, and writes attempted. Keep diagnostics local or development-only and exclude training content, email addresses, and filenames.

Firestore document reads/writes and HTTP request counts are different metrics: one live connection can deliver many billable reads. Correlate controlled test activity with Firebase usage; snapshot counts alone are not billing totals. Transactions can retry, and even an empty server query has a minimum read charge. See [Firestore pricing](https://firebase.google.com/docs/firestore/pricing).

## 1. Remove redundant profile writes

**Files:** `src/lib/useTrainingWorkspace.ts`, `src/lib/cloudStorage.ts`, account creation/profile code if persistence is retained.

The subscription effect calls `saveProfile(user)` every time it starts, including reloads and explicit connection retries. `saveProfile` always writes a fresh server timestamp. The current frontend gets `displayName` from Firebase Auth; no Firestore profile reader was found.

Remove this call from subscription setup. If the Firestore profile has no external consumer, remove the unused helper after confirming that dependency. If the profile is required, write it on account creation and explicit profile changes, rather than on every connection. Do not introduce a profile read on every load just to decide whether to skip a write.

**Acceptance:** reload and connection retry cause zero profile writes; account creation and display-name behavior still work. Retain revision-checked transactions for training changes: their reads protect against overwriting another device's edits.

## 2. Render cached history immediately and avoid redundant cache rewrites

**Files:** `src/lib/useTrainingWorkspace.ts`, `src/lib/cloudStorage.ts`, `src/App.tsx`.

Currently `loadCloudCache(uid)` seeds the merge map and query, but is not immediately converted into displayed workspace state. The hook waits for a listener callback. In addition, every accepted server callback rebuilds the entire workspace and serializes the full map, including metadata-only callbacks enabled by `includeMetadataChanges`.

1. Immediately hydrate `csvImport` and `manualData` using `workspaceFromRecords(cached)` after loading the current user's cache.
2. Separate `hasDisplayData`/`hydrated` from `canWrite`/server synchronization. Allow reading, filtering, and navigation while reconnecting; keep cloud mutations gated until synchronized. Replace broad `inert` wrappers where they disable these read-only actions.
3. Track content changes separately from `fromCache`/pending-write metadata. Process the first authoritative snapshot even when it contains no changed documents, so readiness still advances. Avoid full state reconstruction and cache serialization for later metadata-only events.
4. Coalesce cache persistence during large imports. Persist records and the derived checkpoint as one consistent versioned unit; flush on suitable lifecycle boundaries, but treat a missed flush as a possible extra download, never as lost cloud data. Do not advance a separately stored checkpoint before the corresponding records are durable.
5. Preserve per-user isolation, existing validation, cache-failure warnings, soft deletions, and the inclusive timestamp cursor. Add a user-triggered full resync for suspected stale/corrupt caches.

**Acceptance:** cached records appear before the server responds; offline browsing works after the app shell loads; offline saves remain disabled; metadata-only callbacks do not rewrite history; switching accounts never displays the previous account's history. Verify equal timestamps, malformed cache, cache quota failure, stale revisions, and cross-device deletion.

This improves perceived speed and local work. It does not by itself remove the server synchronization request.

## 3. Cache static assets explicitly

**Files:** new `public/_headers`; verify `wrangler.jsonc` and built `dist` output.

Set `Cache-Control: public, max-age=31536000, immutable` for Vite's fingerprinted `/assets/*` output. Inspect that directory before applying the rule: every covered asset must change URL when its content changes. Keep HTML revalidating with `Cache-Control: no-cache`; verify both `/` and direct SPA routes such as `/log` and `/wrapped`. Give stable unversioned public files a short TTL or version their URLs before granting immutable caching.

Vite copies `public/_headers` into `dist`; Cloudflare supports it for asset responses. Rules do not apply to Worker-generated API responses, so keep the email handler's `no-store` header. Avoid overlapping header rules that concatenate conflicting Cache-Control values. See [Cloudflare static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).

**Acceptance:** with normal browser cache enabled, repeat visits reuse unchanged JS/CSS locally; HTML revalidates; a new deployment loads fresh asset URLs; direct SPA paths receive the intended headers. Check deployed responses because local Vite preview does not prove Cloudflare header behavior.

## 4. Split optional JavaScript and remove the external font waterfall

**Files:** `src/App.tsx`, `src/YearWrapped.tsx`, `src/lib/exportRecap.ts`, `src/index.css`, optional font assets.

`App.tsx` statically imports `DevPage`, which imports Three.js, and `YearWrapped`, which imports the export module and ZIP library. It also embeds the demo CSV through a static raw import.

1. Use module-level `React.lazy` imports with `Suspense` for `DevPage`, `YearWrapped`, `InstructionsPage`, and `PitchPage`. Add a useful chunk-load error/reload state for deployments that invalidate old asset URLs.
2. Dynamically import the raw demo CSV when the user enables demo mode. Cache the import promise, handle errors, and ignore a late result if demo mode was disabled meanwhile.
3. Import export helpers when downloading/emailing. Consider importing `fflate` only inside the ZIP export path so individual-image and email actions do not load ZIP code.
4. Replace the Google Fonts CSS `@import` with a licensed self-hosted WOFF2 font, ideally a suitable variable subset, using `font-display: swap`. Verify the font includes the weights and characters actually used. Preload only if measurement shows it is needed.

**Acceptance:** the initial overview does not load Three.js, Wrapped/export code, or demo CSV; optional pages work on direct navigation; font appearance and image export remain correct. Compare compressed initial bytes and the network waterfall before and after.

Lazy loading may increase the number of small requests when users visit every feature; its goal is lower initial transfer and execution cost. Do not force all dependencies into a single vendor chunk without measuring the result.

## 5. Bound listener rereads safely

**Files:** `src/lib/cloudStorage.ts`, `src/lib/useTrainingWorkspace.ts`; add integration coverage around subscription lifecycle.

`subscribeRecords` chooses its timestamp once. A tab opened without cache listens to the entire collection for that subscription's lifetime. A warm tab's result set likewise accumulates changes since its starting timestamp. Reconnecting can reread that result set. Firebase documents different reconnect billing behavior depending on persistence and disconnect duration; see [listener pricing](https://firebase.google.com/docs/firestore/pricing).

First add diagnostics. If rereads are material, rebase at infrequent lifecycle boundaries, such as returning from an extended hidden/offline interval: unsubscribe the old listener, use the latest fully merged records as the new base, and subscribe with their inclusive latest timestamp. Do not recreate the query after every write or snapshot; each new query has a cost.

Use a generation token to ignore obsolete callbacks and serialize rebases around pending writes. Maintain a single active subscription per workspace. Preserve timestamp nanoseconds, replay equal-timestamp records, and retain deletion markers. Prove that writes made between unsubscribe and resubscribe are received by the new query. Use server timestamps only; do not derive checkpoints from the device clock.

**Acceptance:** one listener remains active; reconnect receives all intervening changes and deletions; same-timestamp updates survive; a long-lived session no longer restarts its original broad query after a deliberate rebase. Keep this change only if controlled traces show a net reduction in returned documents.

## 6. Optimize Wrapped email submission

**Files:** `src/lib/exportRecap.ts`, `src/YearWrapped.tsx`, `worker/index.mjs`, `tests/wrappedEmail.test.mjs`.

The browser uploads nine base64 PNGs. The Worker includes each image twice in its Resend request: an inline version and a downloadable attachment. Base64 adds approximately one third to binary size; duplicate copies further increase provider payload size.

1. Assign an operation UUID to a send attempt and preserve it for retries of the exact same recipient/year/content payload. Forward it through a validated `Idempotency-Key` header to Resend. New content or an intentional fresh send gets a new key. Resend supports deduplication for 24 hours; see [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
2. Reuse rendered card bytes in a bounded in-memory cache only while the export inputs remain identical. Include data, year, palette, layout, dimensions, and font readiness in invalidation; clear it when the view changes or unmounts.
3. Benchmark lower email-specific render dimensions while retaining readable text. Keep high-resolution downloads available separately.
4. Test whether one attachment with a content ID can satisfy inline rendering and attachment access in target email clients. If not, explicitly choose the product behavior before removing either copy.
5. Consider multipart binary upload only if payload measurements justify the additional parser and validation work. Keep current request limits, rate limiting, and `no-store` semantics.

**Acceptance:** a retried identical operation produces one provider email; changed payloads are not silently deduplicated; representative email clients display cards correctly; record uploaded bytes, Worker-to-provider bytes, and render time. Test the provider using mocks, without sending real emails.

## Later: persistent Firestore cache and multi-tab sharing

The app currently uses Firestore's default memory cache plus its own complete account cache. Evaluate `initializeFirestore` with `persistentLocalCache` and `persistentMultipleTabManager` after the earlier changes, using [Firebase's offline persistence documentation](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

This is not a drop-in replacement for the account snapshot. The app's incremental query may only include recently updated records, and SDK cache eviction can remove older documents. Keep a complete durable base unless the sync design is deliberately changed. Explicitly handle storage failures, shared-device retention, logout/account switching, and schema migration. Verify actual listener sharing with two tabs and identical versus different query bounds; do not assume persistence eliminates server reads. Transactions still require connectivity, so persistent reads alone do not enable offline saves.

## Boundaries and release validation

- Keep full history available for all-time charts. Introduce pagination or precomputed aggregates only if measured account sizes justify a data-model migration.
- Keep tombstones until a server-supported reset/retention protocol exists; deleting them can resurrect old data on dormant devices.
- Avoid adding React Query, Redis, a service worker, or an API proxy for the current flow without a measured need. The app already has a realtime subscription and local derived views.
- Ship small changes separately: profile writes; cache hydration; asset headers; lazy loading; then listener/email changes.
- For implementation, run the existing account/model tests, email tests when relevant, TypeScript production build, and lint. Extend tests for sync lifecycle and idempotency; mocked SDK unit tests alone do not prove real listener or billing behavior. Use Firestore emulator/browser integration checks for reconnect, multi-device conflicts, and account isolation, then verify production cache headers and repeat the baseline scenarios.

First milestone: zero profile writes on reload/retry, cached history visible before server synchronization, immutable fingerprinted assets, and no Three.js/demo payload on initial overview. Set numerical transfer/latency targets only after collecting the baseline.
