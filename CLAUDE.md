# CLAUDE.md — project context

Chess academy management SPA. **Read README.md first** for the architecture diagram and
repo layout. Facts below are the non-obvious ones that repeatedly matter.

## Deploy targets (three different things!)

1. **Vercel** (frontend + `api/` functions): project `two_knight_academy`, domain
   `twoknightacademy.vercel.app`, team `mrthamaraiselvam309402s-projects`. Auto-deploys
   from `main`; the **global** `vercel` CLI (not `npx vercel` — the local devDependency is
   ancient with a dead token) is logged in and can `vercel deploy --prod --yes`.
   The projects `chesskidoo-ai-admin` (misconfigured, no API routes) and older domains
   (`chesskidoo-ai-admin.vercel.app`, `twoknightsacadmy.vercel.app`) are legacy — ignore.
2. **Supabase edge functions**: deploy each with
   `npx supabase functions deploy <name> --project-ref zznbanjdkwofsvpzybtr --no-verify-jwt`.
   Committing to git does NOT deploy these.
3. **Database DDL**: no direct path from this machine (no DB password; MCP token is for a
   different project). Ship migrations + a `supabase/sql/RUN_IN_SQL_EDITOR_*.sql` copy and
   ask the user to paste it in the dashboard SQL editor. PostgREST with the service key
   (from `.env`) works for DML/reads and RPC calls.

## Hard constraints

- **Vercel Hobby: max 12 serverless functions.** `api/` uses consolidated dispatchers
  (`zoho.js`, `lichess-proxy.js`, `chesscom-proxy.js`) with shared code in `api/_lib/`
  (underscore = not routed). Never add a function without checking the count.
- **Do not create `api/lichess.js`** (or any file whose route collides with a rewrite):
  filesystem beats rewrites, and `/api/lichess` must reach the Supabase cache rewrite.
- On Vercel Node runtime `request.url` is **relative**: always
  `new URL(request.url, 'http://localhost')`.
- Vercel functions to lichess.org stall intermittently; anything latency-sensitive should
  be served via the Supabase edge function (`lichess-sync`, incl. `?games=1` mode) with
  the Vercel proxy as fallback.
- Frontend: all chess/API fetches use `fetchT()` (timeout); decorative loads are
  fire-and-forget; **bump the `?v=` cache-busters in index.html** when editing
  `scripts.js` or `js/chess-api.js`.
- Migrations must be idempotent and have **unique version prefixes**; remember
  `DROP TRIGGER/POLICY ... ON <missing table>` throws 42P01 even with `IF EXISTS` — guard
  with `to_regclass`.

## Auth & data model quick facts

- Custom auth (not Supabase Auth): edge function `auth` issues tokens; the client stores
  the session blob in `sessionStorage['twoknights_auth']` and trusts it on reload.
- Payments: `payments` table is the source of truth; monthly status derived by
  `payment_status_for_month()` and cached on `students.payment_status` via
  `recompute_payment_statuses()` (daily cron + called after inserts).
  `payments.id` is TEXT PK **without default** — inserts must supply it.
- Zoho Payments: see `docs/ZOHO_PAYMENTS_INTEGRATION.md`. `reference_id` format
  `TKCA-{studentId}-{YYYYMM}` joins Zoho events back to student+month. Simulated mode is
  active until `ZOHO_REFRESH_TOKEN` + `ZOHO_PAYMENTS_ACCOUNT_ID` exist in Vercel env.
- Lichess cache: table `lichess_cache` (PK `lichess_username`), 24h staleness,
  `rating_history` must be the FLAT `[{name, points}]` shape.

## Commands

- Local dev: `node server_proxy.js` (port 3000; mirrors Vercel functions, loads `.env`)
- Lint: `npm run lint` · Tests: `npm test`
- Type-check functions: `Get-ChildItem supabase/functions/*.ts | % { npx tsc --noEmit --skipLibCheck $_.FullName }`
