// Payment status check + reconciliation safety net.
// GET /api/zoho-payment-status?ref=TKCA-{studentId}-{YYYYMM}
//
// 1. If a paid `payments` row already exists for the student+month → paid.
// 2. Otherwise asks Zoho for the tracked payment link's live status; if Zoho
//    says paid but the webhook never landed (misconfigured/missed), records
//    the payment idempotently — exactly what the webhook would have done.
// The frontend polls this after opening checkout and on ?payment=success
// return, so payments auto-record even without a working webhook.

import {
  zohoConfigured,
  zohoApi,
  supabaseConfigured,
  sbRest,
  sbRpc,
  parseReferenceId
} from './zoho.js';

export default async function handler(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    const url = new URL(request.url, 'http://localhost');
    const ref = (url.searchParams.get('ref') || '').trim();
    if (!ref) return json({ error: 'ref is required' }, 400);

    const parsed = parseReferenceId(ref);
    if (!parsed) return json({ error: 'Invalid reference id' }, 400);
    const { studentId, appliedMonth } = parsed;

    if (!supabaseConfigured()) {
      return json({ paid: false, status: 'unknown', warning: 'storage unconfigured' });
    }

    // ── 1. Already recorded (webhook or manual)? ─────────────────────
    const existing = await sbRest(
      `payments?student_id=eq.${encodeURIComponent(studentId)}&applied_month=eq.${encodeURIComponent(appliedMonth)}&status=eq.paid&select=id,transaction_id,amount,payment_date,payment_method&limit=1`
    );
    if (existing.ok && Array.isArray(existing.data) && existing.data[0]) {
      return json({ paid: true, recorded: true, source: 'db', payment: existing.data[0] });
    }

    // ── 2. Find the tracked link for this reference ──────────────────
    const linkRes = await sbRest(
      `zoho_payment_links?reference_id=eq.${encodeURIComponent(ref)}&select=payment_link_id,status,amount,currency&limit=1`
    );
    const link = (linkRes.ok && Array.isArray(linkRes.data) && linkRes.data[0]) || null;
    if (!link) return json({ paid: false, status: 'no-link' });

    // ── 3. Reconcile against Zoho directly ───────────────────────────
    if (zohoConfigured() && link.payment_link_id) {
      const data = await zohoApi(`/paymentlinks/${encodeURIComponent(link.payment_link_id)}`);
      const zlink = data.payment_link || data.paymentlink || data;
      const zstatus = String(zlink.status || '').toLowerCase();

      if (zstatus === 'paid') {
        const paymentsArr = Array.isArray(zlink.payments) ? zlink.payments : [];
        const paymentId = String(paymentsArr[0]?.payment_id || zlink.payment_link_id);
        const transactionId = `ZOHO-${paymentId}`;
        const amount = Number(zlink.amount_paid || zlink.amount || paymentsArr[0]?.amount || link.amount || 0);

        // Idempotent insert — the webhook may land concurrently.
        const dupe = await sbRest(`payments?transaction_id=eq.${encodeURIComponent(transactionId)}&select=id&limit=1`);
        const alreadyThere = dupe.ok && Array.isArray(dupe.data) && dupe.data.length > 0;

        if (!alreadyThere) {
          const inserted = await sbRest('payments', {
            method: 'POST',
            body: {
              // payments.id is TEXT PRIMARY KEY with no default — must be supplied.
              id: `pay_zoho_${paymentId}`,
              student_id: studentId,
              amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
              status: 'paid',
              payment_method: 'Zoho Payments',
              transaction_id: transactionId,
              payment_date: new Date().toISOString(),
              applied_month: appliedMonth,
              description: `Zoho Payments reconciled ref=${ref}`
            }
          });
          if (!inserted.ok) {
            console.error('[Zoho Status] reconcile insert failed:', inserted.status, JSON.stringify(inserted.data).slice(0, 200));
            return json({ paid: true, recorded: false, error: 'record-failed' }, 500);
          }
        }

        await sbRest(`zoho_payment_links?reference_id=eq.${encodeURIComponent(ref)}`, {
          method: 'PATCH',
          body: { status: 'paid', updated_at: new Date().toISOString() }
        }).catch(() => {});
        await sbRpc('recompute_payment_statuses').catch(() => {});

        return json({ paid: true, recorded: true, source: 'zoho-reconcile', transactionId });
      }

      return json({ paid: false, status: zstatus || link.status });
    }

    // Simulated / unconfigured: trust the tracked link status.
    return json({ paid: link.status === 'paid', status: link.status });
  } catch (error) {
    console.error('[Zoho Status] error:', error);
    return json({ error: 'Status check failed', details: String(error.message || error).slice(0, 200) }, 500);
  }
}
