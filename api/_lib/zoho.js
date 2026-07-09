// Shared helpers for the Zoho Payments integration.
// Files under api/_lib are not exposed as Vercel routes.

const ACCOUNTS_BASE = process.env.ZOHO_ACCOUNTS_BASE || 'https://accounts.zoho.in';
const PAYMENTS_BASE = process.env.ZOHO_PAYMENTS_BASE || 'https://payments.zoho.in/api/v1';

// Access tokens live ~1h; cache per warm serverless instance.
let cachedToken = null;
let cachedTokenExpiry = 0;

export function zohoConfigured() {
  return Boolean(
    process.env.ZOHO_CLIENT_ID &&
    process.env.ZOHO_CLIENT_SECRET &&
    process.env.ZOHO_REFRESH_TOKEN &&
    process.env.ZOHO_PAYMENTS_ACCOUNT_ID
  );
}

export async function getZohoAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN
  });

  const res = await fetch(`${ACCOUNTS_BASE}/oauth/v2/token?${params}`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Zoho OAuth refresh failed (${res.status}): ${data.error || 'no access_token'}`);
  }

  cachedToken = data.access_token;
  // Refresh 5 minutes before Zoho's expiry to avoid using a dying token.
  cachedTokenExpiry = Date.now() + Math.max(60, (data.expires_in || 3600) - 300) * 1000;
  return cachedToken;
}

export async function zohoApi(path, { method = 'GET', body } = {}) {
  const token = await getZohoAccessToken();
  const accountId = process.env.ZOHO_PAYMENTS_ACCOUNT_ID;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${PAYMENTS_BASE}${path}${sep}account_id=${encodeURIComponent(accountId)}`, {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Zoho API ${method} ${path} failed (${res.status}): ${data.message || JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

// ── Supabase REST (service role) ──────────────────────────────
// Minimal PostgREST client; the webhook and link tracker must not
// depend on the browser SDK.

export function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function sbRest(pathAndQuery, { method = 'GET', body, headers = {} } = {}) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${pathAndQuery}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

export async function sbRpc(fn, args = {}) {
  return sbRest(`rpc/${fn}`, { method: 'POST', body: args });
}

// reference_id format shared by init + webhook: TKCA-{studentId}-{YYYYMM}
export function buildReferenceId(studentId, appliedMonth) {
  return `TKCA-${studentId}-${String(appliedMonth).replace('-', '')}`;
}

export function parseReferenceId(referenceId) {
  const m = /^TKCA-(.+)-(\d{4})(\d{2})$/.exec(String(referenceId || ''));
  if (!m) return null;
  return { studentId: m[1], appliedMonth: `${m[2]}-${m[3]}` };
}
