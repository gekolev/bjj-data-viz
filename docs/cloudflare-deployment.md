# Cloudflare frontend deployment

This project is a Vite frontend served by the `bjj-data-viz` Cloudflare Worker. Wrangler serves `dist` as static assets. SPA fallback supports direct visits to `/log`, `/sessions`, `/dev`, and `/instructions`.

## Local development

Copy `.env.example` to `.env.local` and set `VITE_FIREBASE_API_KEY` to the Firebase browser key. Use `npm run dev`. The existing local configuration is preserved.

Vite reads `.env.local` when building the browser app. Email delivery uses Worker runtime secrets, configured below. Environment files, `.dev.vars` files, and Wrangler state are ignored by Git; `.env.example` remains tracked.

## Wrapped email delivery

The Wrapped email form posts nine PNG attachments to `/api/wrapped/email`. A custom Worker forwards the message to Resend. Static app routes continue to use the assets binding. No recipient addresses or card images are stored by the app; Resend processes delivery.

1. Create a Resend account, verify your sending domain, and create an API key with sending permission.
2. Set the runtime secrets (never use `VITE_` variables for these):

   ```sh
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put WRAPPED_EMAIL_FROM
   ```

   For `WRAPPED_EMAIL_FROM`, enter a verified sender such as `MatMetrics <wrapped@your-domain.com>`.
3. Deploy with `npm run deploy:cloudflare`.

Without both values the endpoint returns a clear configuration error. The form does not claim delivery until the provider accepts the message. Requests have a 24 MB JSON limit, exactly nine PNG attachments, same-origin checks, and rate limits of two requests per minute per source IP and recipient per Cloudflare location. The namespace `76740261` should be unique within your Cloudflare account. These limits help contain casual abuse; add stronger bot protection before promoting an anonymous public email campaign.

For local development, create an ignored `.dev.vars` in the project root:

```dotenv
RESEND_API_KEY=re_your_actual_key
WRAPPED_EMAIL_FROM="MatMetrics <wrapped@your-verified-domain.com>"
```

Restart `npm run dev` after setting these values. Vite runs the production email handler locally in the same process; there is no proxy or separate backend to start. The local limiter uses in-memory counters, while production uses the Cloudflare binding. Local email submits real messages to Resend when configured. Without credentials the form explains that email sending is not configured. You can also build and run `npm run preview:cloudflare` to test the full Worker locally.

Run the endpoint tests with `node --test tests/wrappedEmail.test.mjs`. Tests mock the provider and send no real email.

API references: [Resend attachments](https://resend.com/docs/send-with-attachments), [Cloudflare rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

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
