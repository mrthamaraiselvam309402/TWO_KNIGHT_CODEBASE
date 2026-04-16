export default async function handler(request, response) {
  // Handle CORS — restrict to known origins
  const allowedOrigins = ['https://chesskidoo-ai-admin.vercel.app', 'http://localhost:3000', 'http://localhost:5000'];
  const origin = request.headers?.origin || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  response.setHeader('Access-Control-Allow-Origin', corsOrigin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;

  if (!keyId) {
    return response.status(200).json({
      keyId: null,
      configured: false
    });
  }

  return response.status(200).json({
    keyId: keyId,
    configured: true
  });
}
