# Zoho Payments Integration — Study Plan & Architecture

Source documents: `TKCA_Payment_Module_Developer_Roadmap_v2.pdf` (business rules) and the
Zoho Payments OpenAPI specs (`openapi-all.zip`: payment-links, payments, webhooks, refunds,
customers, …). This document maps the roadmap onto this codebase and records exactly how the
integration works, what is implemented, and what remains.

---

## 1. What the roadmap asks for (condensed)

- **LMS is the source of truth**; Zoho Payments is only the online collection rail.
- **Monthly cycle**: generate invoice + Zoho payment link on the **10th**, reminder on the
  **15th**, final reminder on the **20th** — always the *same* link. Stop reminders on payment.
- **Billing eligibility**: `status = Active` AND `admission fee paid` AND `admission-month fee paid`.
  Admission month is always collected manually (cash/UPI) — never via Zoho.
- **Payment methods**: Zoho Payments, Cash, UPI, Bank Transfer. Manual payments mark the
  invoice Paid and stop reminders.
- **Webhook** flips the invoice to Paid, generates a receipt, cancels pending reminders.
- **Invoice statuses**: Pending, Paid, Overdue, Cancelled. Inactive students are excluded
  from all billing jobs; history is retained.

## 2. What the Zoho Payments API gives us (from the OpenAPI specs)

| Concern | Endpoint | Notes |
|---|---|---|
| Create link | `POST https://payments.zoho.in/api/v1/paymentlinks?account_id=…` | body: `amount, currency:"INR", description, email, phone, reference_id, expires_at, notify_customer{email,sms}, return_url` → `{payment_link_id, url, status}` |
| Read link | `GET /paymentlinks/{id}?account_id=…` | status: `active / paid / canceled / expired`, embedded `payments[]` |
| Cancel link | `PUT /paymentlinks/{id}/cancel?account_id=…` | used when fee changes mid-cycle or student goes Inactive |
| Webhooks | HMAC-SHA256 `signing_key`; events `payment_link.paid`, `payment.succeeded`, `payment.failed`, `refund.*` | signature of the **raw body** arrives in the request headers; verify before trusting |
| Auth | OAuth2 via `accounts.zoho.in/oauth/v2/token` | server-to-server refresh-token grant; scopes `ZohoPay.payments.CREATE/READ/UPDATE` |

Key design consequence: **`reference_id` is our join key.** We set it to
`TKCA-{studentId}-{YYYYMM}` so any webhook event can be traced back to a student + billing
month without storing Zoho state first.

## 3. Architecture in this codebase

```
Parent portal (billing tab)          Admin (Payments page)
        │  Pay Online                        │ share link via WhatsApp
        ▼                                    ▼
POST /api/zoho-payment-init  ──────────────────────────────┐
  · reuses active link for (student, month) if one exists  │  Supabase (source of truth)
  · else OAuth refresh-grant → create Zoho payment link    ├─ zoho_payment_links (link cache,
  · records link in zoho_payment_links                     │   reminder_stage, status)
  · no Zoho env configured → simulated checkout page       │
        │ url                                              │
        ▼                                                  │
Zoho hosted payment page  → parent pays                    │
        │                                                  │
        ▼                                                  │
POST /api/zoho-webhook  (payment_link.paid etc.)           │
  · HMAC-SHA256 verify with ZOHO_WEBHOOK_SECRET            │
  · idempotent by transaction_id                           ├─ payments (Paid row, method
  · parses reference_id → student + applied_month          │   "Zoho Payments")
  · marks zoho_payment_links.status = paid                 │
  · RPC recompute_payment_statuses()                       ├─ students.payment_status cache
```

The existing derived-status engine (`payment_status_for_month()` +
`recompute_payment_statuses()`, migration `20260709000001_simplify_payment_status`) already
implements the roadmap's invoice-status semantics (Pending → Due → Overdue → Paid) from
`payments` rows — so a webhook only has to insert one Paid payment row and everything else
(status chips, dashboards, receipts) follows.

## 4. Environment variables

| Var | Where | Status |
|---|---|---|
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` | Vercel env | already in `.env` |
| `ZOHO_REFRESH_TOKEN` | Vercel env | **to create** — see §5 |
| `ZOHO_PAYMENTS_ACCOUNT_ID` | Vercel env | **to fill** — Zoho Payments dashboard → Settings |
| `ZOHO_WEBHOOK_SECRET` | Vercel env | already in `.env`; must equal the webhook `signing_key` |
| `ZOHO_ACCOUNTS_BASE` | optional | defaults to `https://accounts.zoho.in` |
| `ZOHO_PAYMENTS_BASE` | optional | defaults to `https://payments.zoho.in/api/v1` |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | needed by the webhook to record payments |
| `SITE_URL` | optional | return_url base, defaults to the request origin |

Until `ZOHO_REFRESH_TOKEN` + `ZOHO_PAYMENTS_ACCOUNT_ID` are set, `/api/zoho-payment-init`
runs in **simulated mode** (hosted page `simulated-zoho-checkout.html`, which completes the
full loop against the webhook in simulated mode) — safe for demos, zero code changes to flip
to live.

## 5. One-time Zoho setup (manual, ~15 min)

1. **Self Client** at <https://api-console.zoho.in> → Generate Code with scope
   `ZohoPay.payments.CREATE,ZohoPay.payments.READ,ZohoPay.payments.UPDATE` → exchange:
   `POST https://accounts.zoho.in/oauth/v2/token?grant_type=authorization_code&code=…&client_id=…&client_secret=…`
   → save `refresh_token` as `ZOHO_REFRESH_TOKEN` in Vercel.
2. **Account ID**: Zoho Payments dashboard → visible in every API sample → `ZOHO_PAYMENTS_ACCOUNT_ID`.
3. **Register webhook** (once):
   `POST /api/v1/webhooks?account_id=…` with
   `{"name":"TKCA LMS","url":"https://<prod-domain>/api/zoho-webhook","enabled_events":["payment_link.paid","payment.succeeded","payment.failed"]}`
   → response contains `signing_key` (shown **only once**) → set as `ZOHO_WEBHOOK_SECRET`.
4. Run `supabase/sql/RUN_IN_SQL_EDITOR_zoho_payment_links.sql` in the Supabase SQL editor
   (same content as migration `20260710000002_zoho_payment_links.sql`).

## 6. Phase plan

| Phase | Scope | Status |
|---|---|---|
| **1. Collection rail** | payment-link create/reuse, webhook → Paid row, parent-portal Pay Online, simulated mode, link tracking table | **implemented in this change** |
| **2. Billing scheduler** | pg_cron job on the 10th: eligible students (Active + both admission toggles) → create links + WhatsApp/email dispatch; 15th/20th reminder escalation using `reminder_stage`; stop on paid | table + reference_id format ready; job not yet scheduled |
| **3. Admission workflow** | admission screen fields (fee editable, both Paid toggles, collected amount), block auto-billing for admission month | students table already has `admission_fee`; UI toggles pending |
| **4. Ops extras** | refunds via `/refunds`, payment-mode summary on admin dashboard, link cancellation on fee change / Inactive | dashboard summary exists; refunds pending |

## 7. Failure & security posture

- Webhook is **idempotent** (`transaction_id` unique check before insert) — Zoho retries are safe.
- Signature verification is **mandatory** whenever `ZOHO_WEBHOOK_SECRET` is set; unsigned
  events are only accepted in simulated mode (no Zoho credentials configured at all).
- OAuth access tokens are cached in-memory per serverless instance (~55 min TTL, Zoho issues
  1-hour tokens) — cold starts just re-run the refresh grant.
- Link reuse guarantees the roadmap's "same link across reminders" rule and prevents
  duplicate active links for the same (student, month).
- All Supabase writes use the service-role key server-side only; nothing new is exposed to
  the browser.
