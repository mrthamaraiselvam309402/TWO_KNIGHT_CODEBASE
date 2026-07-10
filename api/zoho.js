// Consolidated Zoho Payments function (Hobby plan allows max 12 functions,
// so init/webhook/status share one). Public URLs are unchanged — vercel.json
// rewrites /api/zoho-payment-init, /api/zoho-webhook and
// /api/zoho-payment-status here with an ?action= param.

import initHandler from './_lib/zoho-init.js';
import webhookHandler from './_lib/zoho-webhook.js';
import statusHandler from './_lib/zoho-status.js';

const PATH_ACTIONS = {
  'zoho-payment-init': 'init',
  'zoho-webhook': 'webhook',
  'zoho-payment-status': 'status',
  'zoho-debug': 'debug'
};

// Vercel's Node runtime only honors the web fetch-style signature on NAMED
// HTTP-method exports; a default export is treated as (req, res) and any
// returned Response is silently ignored (requests then hang to timeout).
async function route(request) {
  const url = new URL(request.url, 'http://localhost');
  const pathKey = Object.keys(PATH_ACTIONS).find((k) => url.pathname.includes(k));
  const action = url.searchParams.get('action') || (pathKey ? PATH_ACTIONS[pathKey] : '');

  switch (action) {
    case 'init':
      return initHandler(request);
    case 'webhook':
      return webhookHandler(request);
    case 'status':
      return statusHandler(request);
    case 'debug':
      return new Response(JSON.stringify({
        node: process.version,
        env: {
          SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          ZOHO_CLIENT_ID: Boolean(process.env.ZOHO_CLIENT_ID),
          ZOHO_CLIENT_SECRET: Boolean(process.env.ZOHO_CLIENT_SECRET),
          ZOHO_REFRESH_TOKEN: Boolean(process.env.ZOHO_REFRESH_TOKEN),
          ZOHO_PAYMENTS_ACCOUNT_ID: Boolean(process.env.ZOHO_PAYMENTS_ACCOUNT_ID),
          ZOHO_WEBHOOK_SECRET: Boolean(process.env.ZOHO_WEBHOOK_SECRET)
        }
      }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
    default:
      return new Response(JSON.stringify({ error: 'Unknown zoho action', action }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}

export const GET = route;
export const POST = route;
export const OPTIONS = route;
