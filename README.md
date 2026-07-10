# Two Knights Chess Academy — Management System

Full academy management platform: students, coaches, batches, attendance, homework,
payments (Zoho Payments / Razorpay / manual), chess-platform integrations
(Lichess + Chess.com), AI assistant, and executive reporting.

**Production:** <https://twoknightacademy.vercel.app> (Vercel project `two_knight_academy`,
auto-deploys from `main`)

## Architecture

```
Browser (vanilla JS SPA, public/)
   │
   ├── /api/* ──► Vercel serverless functions (api/)          — external proxies + payments
   │                 · zoho.js            payment init/webhook/status (?action=)
   │                 · lichess-proxy.js   profile/games/extras/test   (?type=)
   │                 · chesscom-proxy.js  profile/clubs/games         (?type=)
   │                 · razorpay/, chessable-proxy.js, geo.js
   │                 · _lib/              shared handlers (not routed)
   │
   └── /api/* ──► Supabase Edge Functions (supabase/functions/) — core CRUD + auth
                     students, coaches, payments, attendance, homework, batches,
                     auth, access_control, lichess-sync (cache + live games), …
                     ▼
                  Supabase Postgres (source of truth; supabase/migrations/)
```

- `vercel.json` **rewrites** decide where each `/api/*` path goes: named routes hit the
  Vercel functions above; everything else falls through to
  `https://<project>.supabase.co/functions/v1/:path*`.
- Serverless function count must stay **≤ 12** (Vercel Hobby limit) — that is why the
  Vercel functions are consolidated dispatchers; shared logic lives in `api/_lib/`
  (underscore paths are not routed).
- On Vercel's Node runtime `request.url` is **relative** — always parse with
  `new URL(request.url, 'http://localhost')`.

## Repository layout

| Path | Purpose |
|---|---|
| `public/` | The SPA. `index.html` (all pages as `.page` divs), `scripts.js` (core engine: routing, data sync, business logic), `js/` (feature modules: chess-api, reporting, homework, …) |
| `api/` | Vercel serverless functions (see diagram) |
| `supabase/functions/` | Deno edge functions — deploy with `npx supabase functions deploy <name> --no-verify-jwt` |
| `supabase/migrations/` | Schema migrations (idempotent; unique version prefixes) |
| `supabase/sql/` | Paste-ready SQL-editor scripts (`RUN_IN_SQL_EDITOR_*.sql`) + `archive/` |
| `docs/` | Living docs (`ZOHO_PAYMENTS_INTEGRATION.md` is the payments reference) + `archive/` |
| `scripts/` | `build.cjs` (Vercel build) + `dev-archive/` (historical one-off scripts) |
| `server_proxy.js` | Local dev server (port 3000): serves `public/`, mirrors the Vercel functions, proxies the rest to Supabase |

## Development

```bash
npm install
node server_proxy.js        # http://localhost:3000
npm run lint                # eslint public/scripts.js
npm test                    # jest
```

## Deployment

- **Frontend + Vercel functions:** push to `main` (auto-deploy) or `vercel deploy --prod`.
- **Supabase edge functions:** `npx supabase functions deploy <name> --project-ref <ref> --no-verify-jwt`
  (deployed **separately** from Vercel — pushing to git does *not* update them).
- **Database:** add a migration under `supabase/migrations/` *and* a paste-ready copy in
  `supabase/sql/` (the project applies SQL via the Supabase dashboard SQL editor).

## Payments (Zoho)

See [docs/ZOHO_PAYMENTS_INTEGRATION.md](docs/ZOHO_PAYMENTS_INTEGRATION.md) for the full
architecture, environment variables, and go-live runbook. Until `ZOHO_REFRESH_TOKEN` and
`ZOHO_PAYMENTS_ACCOUNT_ID` are set in Vercel, checkout runs in clearly-labeled simulated
mode and still exercises the full record-payment loop.

## Conventions

- Frontend script tags carry cache-busting params (`scripts.js?v=…`) — **bump them** when
  changing `scripts.js` / `js/chess-api.js`.
- Every chess/network fetch in the frontend goes through `fetchT()` (hard timeout) and
  decorative data loads fire-and-forget — slow endpoints must never block first render.
- Payment truth lives in the `payments` table; per-month status is derived by
  `payment_status_for_month()` / `recompute_payment_statuses()` in Postgres.
