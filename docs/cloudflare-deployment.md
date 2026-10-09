# Cloudflare frontend deployment

This project is a Vite frontend served by the `bjj-data-viz` Cloudflare Worker. Wrangler serves `dist` as static assets. SPA fallback supports direct visits to `/log`, `/sessions`, `/dev`, and `/instructions`.

## Local development

Copy `.env.example` to `.env.local` and set `VITE_FIREBASE_API_KEY` to the Firebase browser key. Use `npm run dev`. The existing local configuration is preserved.

Vite reads `.env.local` when building the browser app. This project does not need `.dev.vars` because it has no custom Worker code consuming runtime bindings. Environment files, `.dev.vars` files, and Wrangler state are ignored by Git; `.env.example` remains tracked.

## Deploy with Wrangler

```sh
npm ci
npx wrangler login
npm run deploy:cloudflare
```

The deploy script builds the frontend using `.env.local` or environment variables supplied to the build process, then runs `wrangler deploy`. `keep_vars` preserves existing dashboard-managed Worker variables. No account IDs, credentials, or Firebase API-key values are committed in the Wrangler configuration.

To preview the built Cloudflare app locally, run `npm run preview:cloudflare`.

## Automatic Cloudflare Git builds

In Workers & Pages, select `bjj-data-viz`, open Settings → Build, and configure:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Build variable: `VITE_FIREBASE_API_KEY`, using the Firebase browser key
- Recommended build variable: `NODE_VERSION=24.12.0` (the installed Firebase SDK declares Node >=24.12.0)

Configure the key in **Build variables and secrets**, rather than runtime Variables & Secrets. Configure non-production branch builds too if enabled. The Vite build now fails with a clear error when the key is missing, preventing a deployment that would fail at startup.

`wrangler secret put` configures Worker runtime secrets. It does not provide values to Vite's earlier frontend build, so it cannot replace this build variable. The browser Firebase key remains public in the compiled app; database access is protected by Firebase Authentication and Firestore rules.

After deploying, ensure the deployed hostname is in Firebase Authentication's authorized domains.

References:

- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- https://vite.dev/guide/env-and-mode
