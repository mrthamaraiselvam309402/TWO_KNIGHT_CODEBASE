export default async function handler(request) {
  // Handle CORS
  const allowedOrigins = ['https://twoknights-ai-admin.vercel.app', 'http://localhost:3000', 'http://localhost:5000'];
  const origin = request.headers?.get('origin') || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { amount, currency, studentId, studentName } = body;

    // Zoho Checkout / Payments integration typically requires valid API Keys 
    // to generate a payment intent or hosted checkout link.
    // In Simulation mode (missing keys), we mock the hosted URL.
    const hasKeys = process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET;

    if (!hasKeys) {
      console.log(`[Zoho Simulated] Initiating checkout for ${studentName} - Amount: ${amount}`);
      return new Response(JSON.stringify({
        simulated: true,
        orderId: `ZOHO_ORD_SIM_${Date.now()}`,
        hostedUrl: `/simulated-zoho-checkout.html?amt=${amount}&sid=${studentId}`,
        amount,
        currency: currency || 'INR'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Example code for real Zoho integration:
    // const zohoToken = await getZohoToken();
    // const zohoResponse = await fetch('https://subscriptions.zoho.com/api/v1/hostedpages', { ... });

    return new Response(JSON.stringify({ error: 'Real Zoho integration requires further configuration' }), {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Zoho Init Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to initialize Zoho payment' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
