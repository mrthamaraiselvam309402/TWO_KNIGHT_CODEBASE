// Zoho Payments webhook receiver.
// Verifies the HMAC-SHA256 signature, then records the payment in Supabase
// (idempotent by transaction id), marks the tracked payment link paid, and
// refreshes derived payment statuses. The LMS `payments` table stays the
// source of truth. See docs/ZOHO_PAYMENTS_INTEGRATION.md.

import {
  zohoConfigured,
  supabaseConfigured,
  sbRest,
  sbRpc,
  parseReferenceId
} from './zoho.js';

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// Zoho sends "X-Zoho-Webhook-Signature: t=<unixMillis>,v=<hexHmac>" and the
// HMAC-SHA256 is computed over `${t}.${rawBody}` (timestamp + '.' + raw body).
// Fall back to treating a bare header as the hex signature over the raw body.
function parseZohoSignature(header) {
  const h = String(header || '').trim();
  const out = { t: '', v: '' };
  if (h.includes('=')) {
    for (const part of h.split(',')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const k = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      if (k === 't') out.t = val;
      else if (k === 'v') out.v = val;
    }
  } else {
    out.v = h; // bare hex signature, no timestamp
  }
  return out;
}

export default async function handler(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Zoho-Webhook-Signature'
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const rawBody = await request.text();
    let payload = {};
    try { payload = JSON.parse(rawBody); } catch { /* handled below */ }

    // ── Signature verification ────────────────────────────────
    // Mandatory whenever a signing key is configured. Simulated events
    // (from simulated-zoho-checkout.html) are only accepted while Zoho
    // itself is unconfigured, i.e. demo environments.
    const secret = process.env.ZOHO_WEBHOOK_SECRET;
    const signatureHeader =
      request.headers?.get('x-zoho-webhook-signature') ||
      request.headers?.get('x-zohopayments-signature') || '';

    if (secret) {
      const { t, v } = parseZohoSignature(signatureHeader);
      // Zoho signs `${timestamp}.${rawBody}`; bare-hex fallback signs the body.
      const signedData = t ? `${t}.${rawBody}` : rawBody;
      const expected = await hmacSha256Hex(secret, signedData);
      if (!timingSafeEqual(expected, v.toLowerCase())) {
        const simulatedAllowed = !zohoConfigured() && payload.simulated === true;
        if (!simulatedAllowed) {
          console.warn('[Zoho Webhook] signature mismatch, rejecting');
          return json({ error: 'Invalid signature' }, 401);
        }
      }
    } else if (zohoConfigured()) {
      // Live credentials but no signing key: refuse to process blind.
      console.error('[Zoho Webhook] ZOHO_WEBHOOK_SECRET missing while Zoho is configured');
      return json({ error: 'Webhook not configured' }, 500);
    }

    // ── Normalize the event ───────────────────────────────────
    // Real Zoho events: { event_type: 'payment_link.paid'|'payment.succeeded'|...,
    //                     data: { ...payment or payment_link object } }
    // Simulated events mirror the same shape with simulated:true.
    const eventType = String(payload.event_type || payload.event || '').toLowerCase();
    const entity = payload.data?.payment_link || payload.data?.payment || payload.data || payload;

    const paidEvents = ['payment_link.paid', 'payment.succeeded', 'payment_success'];
    if (!paidEvents.includes(eventType)) {
      // Acknowledge everything else (failed/canceled/refund events are
      // logged for now; refunds are phase 4 in the integration plan).
      console.log(`[Zoho Webhook] ignoring event: ${eventType || '(none)'}`);
      return json({ received: true, ignored: eventType || 'unknown' });
    }

    const referenceId = entity.reference_id || payload.reference_id || '';
    const parsed = parseReferenceId(referenceId);
    const studentId = parsed?.studentId || String(entity.student_id || payload.studentId || '').trim();
    const appliedMonth = parsed?.appliedMonth ||
      (/^\d{4}-\d{2}$/.test(payload.month || '') ? payload.month : new Date().toISOString().slice(0, 7));

    const paymentsArr = Array.isArray(entity.payments) ? entity.payments : [];
    const paymentId = String(
      entity.payment_id || paymentsArr[0]?.payment_id || payload.payment_id || `ZOHO-${Date.now()}`
    );
    const amount = Number(entity.amount_paid || entity.amount || paymentsArr[0]?.amount || payload.amount || 0);

    if (!studentId) {
      console.error('[Zoho Webhook] cannot resolve student from reference_id:', referenceId);
      return json({ received: true, warning: 'unresolved student' });
    }

    if (!supabaseConfigured()) {
      console.error('[Zoho Webhook] SUPABASE_URL / SERVICE_ROLE_KEY missing; payment NOT recorded:', paymentId);
      return json({ received: true, warning: 'storage unconfigured' });
    }

    const transactionId = `ZOHO-${paymentId}`;

    // ── Idempotency: Zoho retries webhooks ────────────────────
    const dupe = await sbRest(`payments?transaction_id=eq.${encodeURIComponent(transactionId)}&select=id&limit=1`);
    if (dupe.ok && Array.isArray(dupe.data) && dupe.data.length > 0) {
      return json({ received: true, duplicate: true });
    }

    const inserted = await sbRest('payments', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        // payments.id is TEXT PRIMARY KEY with no default — must be supplied.
        // Deterministic per Zoho payment id → doubles as idempotency.
        id: `pay_zoho_${paymentId}`,
        student_id: studentId,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
        status: 'paid',
        payment_method: payload.simulated ? 'Zoho (Simulated)' : 'Zoho Payments',
        transaction_id: transactionId,
        payment_date: new Date().toISOString(),
        applied_month: appliedMonth,
        description: `Zoho Payments ${eventType} ref=${referenceId || 'n/a'}`
      }
    });
    if (!inserted.ok) {
      console.error('[Zoho Webhook] payment insert failed:', inserted.status, JSON.stringify(inserted.data).slice(0, 300));
      // 500 so Zoho retries; the idempotency check makes retries safe.
      return json({ error: 'Failed to record payment' }, 500);
    }

    // Mark the tracked link paid → reminder engine stops immediately.
    if (referenceId) {
      await sbRest(`zoho_payment_links?reference_id=eq.${encodeURIComponent(referenceId)}`, {
        method: 'PATCH',
        body: { status: 'paid', updated_at: new Date().toISOString() }
      }).catch(() => {});
    }

    // Refresh the derived payment_status cache (Paid/Pending/Due/Overdue).
    const rpc = await sbRpc('recompute_payment_statuses');
    if (!rpc.ok) console.warn('[Zoho Webhook] recompute_payment_statuses failed:', rpc.status);

    console.log(`[Zoho Webhook] recorded ${transactionId} for ${studentId} (${appliedMonth})`);
    return json({ received: true, recorded: true, transactionId });
  } catch (error) {
    console.error('Zoho Webhook Error:', error);
    return json({ error: 'Webhook processing failed' }, 500);
  }
}
