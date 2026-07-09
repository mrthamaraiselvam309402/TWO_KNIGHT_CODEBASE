// Creates (or reuses) a Zoho Payments hosted payment link for a student's
// monthly fee. Falls back to the simulated checkout page when Zoho
// credentials are not configured, so the flow stays demoable.
// See docs/ZOHO_PAYMENTS_INTEGRATION.md.

import {
  zohoConfigured,
  zohoApi,
  supabaseConfigured,
  sbRest,
  buildReferenceId
} from './zoho.js';

export default async function handler(request) {
  const allowedOrigins = [
    'https://chesskidoo-ai-admin.vercel.app',
    'https://twoknights-ai-admin.vercel.app',
    'https://twoknightacademy.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000'
  ];
  const origin = request.headers?.get('origin') || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const studentId = String(body.studentId || '').trim();
    const studentName = String(body.studentName || 'Student').slice(0, 80);
    const amount = Number(body.amount);
    const currency = String(body.currency || 'INR');
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);

    // Billing month the link applies to; defaults to the current month.
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const appliedMonth = /^\d{4}-\d{2}$/.test(body.month || '') ? body.month : defaultMonth;

    if (!studentId) return json({ error: 'studentId is required' }, 400);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'A positive amount is required' }, 400);

    const referenceId = buildReferenceId(studentId, appliedMonth);
    const description = `Two Knights Chess Academy — tuition ${appliedMonth} — ${studentName} (${studentId})`;

    // ── Simulated mode ─────────────────────────────────────────
    if (!zohoConfigured()) {
      console.log(`[Zoho Simulated] link for ${studentId} ${appliedMonth} amount=${amount}`);
      return json({
        simulated: true,
        reused: false,
        referenceId,
        month: appliedMonth,
        url: `/simulated-zoho-checkout.html?amt=${encodeURIComponent(amount)}&sid=${encodeURIComponent(studentId)}&month=${encodeURIComponent(appliedMonth)}&ref=${encodeURIComponent(referenceId)}`,
        amount,
        currency
      });
    }

    // ── Reuse an active link for this (student, month) ────────
    // Roadmap rule: reminders always reuse the same link.
    if (supabaseConfigured()) {
      const existing = await sbRest(
        `zoho_payment_links?student_id=eq.${encodeURIComponent(studentId)}&applied_month=eq.${encodeURIComponent(appliedMonth)}&status=eq.active&select=payment_link_id,url,amount,status&limit=1`
      );
      if (existing.ok && Array.isArray(existing.data) && existing.data[0]) {
        const link = existing.data[0];
        // Amount changed since the link was created (fee edit) → cancel and reissue.
        if (Number(link.amount) === amount) {
          return json({
            simulated: false,
            reused: true,
            referenceId,
            month: appliedMonth,
            url: link.url,
            paymentLinkId: link.payment_link_id,
            amount,
            currency
          });
        }
        try {
          await zohoApi(`/paymentlinks/${link.payment_link_id}/cancel`, { method: 'PUT' });
          await sbRest(`zoho_payment_links?payment_link_id=eq.${encodeURIComponent(link.payment_link_id)}`, {
            method: 'PATCH',
            body: { status: 'canceled', updated_at: new Date().toISOString() }
          });
        } catch (e) {
          console.warn('[Zoho] failed to cancel stale link, continuing:', e.message);
        }
      }
    }

    // ── Create a fresh link ────────────────────────────────────
    // Links expire at the end of the following month, comfortably past
    // the 20th final-reminder stage.
    const expiry = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const expiresAt = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`;
    const siteUrl = process.env.SITE_URL || `https://${request.headers?.get('host') || 'chesskidoo-ai-admin.vercel.app'}`;

    const payload = {
      amount,
      currency,
      description,
      reference_id: referenceId,
      expires_at: expiresAt,
      return_url: `${siteUrl}/?payment=success&ref=${encodeURIComponent(referenceId)}`
    };
    if (email) payload.email = email;
    if (phone) {
      payload.phone = phone;
      payload.phone_country_code = 'IN';
    }
    if (email || phone) {
      payload.notify_customer = { email: Boolean(email), sms: Boolean(phone) };
    }

    const created = await zohoApi('/paymentlinks', { method: 'POST', body: payload });
    const link = created.payment_link || created.paymentlink || created;
    if (!link || !link.url) {
      console.error('[Zoho] unexpected create response:', JSON.stringify(created).slice(0, 300));
      return json({ error: 'Zoho did not return a payment link' }, 502);
    }

    if (supabaseConfigured()) {
      const tracked = await sbRest('zoho_payment_links', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: {
          payment_link_id: String(link.payment_link_id || ''),
          reference_id: referenceId,
          student_id: studentId,
          applied_month: appliedMonth,
          amount,
          currency,
          url: link.url,
          status: 'active'
        }
      });
      if (!tracked.ok) console.warn('[Zoho] link tracking insert failed:', tracked.status, JSON.stringify(tracked.data).slice(0, 200));
    }

    return json({
      simulated: false,
      reused: false,
      referenceId,
      month: appliedMonth,
      url: link.url,
      paymentLinkId: String(link.payment_link_id || ''),
      expiresAt,
      amount,
      currency
    });
  } catch (error) {
    console.error('Zoho Init Error:', error);
    return json({ error: 'Failed to initialize Zoho payment', details: String(error.message || error).slice(0, 200) }, 500);
  }
}
