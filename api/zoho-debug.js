// TEMPORARY diagnostics endpoint: reports why the Zoho functions crash on
// Vercel (import failure, node version, env presence booleans). Remove
// after the FUNCTION_INVOCATION_FAILED root cause is fixed.

export default async function handler() {
  const out = {
    node: typeof process !== 'undefined' ? process.version : 'no-process',
    env: {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      ZOHO_CLIENT_ID: Boolean(process.env.ZOHO_CLIENT_ID),
      ZOHO_CLIENT_SECRET: Boolean(process.env.ZOHO_CLIENT_SECRET),
      ZOHO_REFRESH_TOKEN: Boolean(process.env.ZOHO_REFRESH_TOKEN),
      ZOHO_PAYMENTS_ACCOUNT_ID: Boolean(process.env.ZOHO_PAYMENTS_ACCOUNT_ID),
      ZOHO_WEBHOOK_SECRET: Boolean(process.env.ZOHO_WEBHOOK_SECRET)
    }
  };
  try {
    const mod = await import('./_lib/zoho.js');
    out.helperImport = { ok: true, exports: Object.keys(mod) };
  } catch (e) {
    out.helperImport = { ok: false, error: String(e), stack: (e.stack || '').slice(0, 400) };
  }
  return new Response(JSON.stringify(out, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
