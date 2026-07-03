import Razorpay from 'razorpay';
import crypto from 'crypto';

const allowedOrigins = ['https://twoknights-ai-admin.vercel.app', 'http://localhost:3000', 'http://localhost:5000'];

export default async function handler(request, response) {
  const origin = request.headers?.origin || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  function setCors(methods = 'GET, OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', corsOrigin);
    response.setHeader('Access-Control-Allow-Methods', methods);
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (request.method === 'OPTIONS') {
    setCors();
    return response.status(200).end();
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/razorpay\/?/, '') || 'config';

  if (path === 'config') {
    setCors('GET, OPTIONS');
    if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
    const keyId = process.env.RAZORPAY_KEY_ID;
    return response.status(200).json(keyId ? { keyId, configured: true } : { keyId: null, configured: false });
  }

  if (path === 'order') {
    setCors('POST, OPTIONS');
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
    const body = request.body || {};
    const { amount, currency, receipt } = body;

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return response.status(200).json({
        simulated: true,
        id: "order_sim_" + Date.now(),
        amount,
        currency: currency || 'INR'
      });
    }

    try {
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      const options = {
        amount: amount * 100,
        currency: currency || 'INR',
        receipt: receipt || "receipt_" + Date.now(),
      };

      const order = await razorpay.orders.create(options);
      return response.status(200).json(order);
    } catch (error) {
      console.error('Razorpay Order Error:', error);
      return response.status(500).json({ error: 'Failed to create order' });
    }
  }

  if (path === 'verify') {
    setCors('POST, OPTIONS');
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
    const body = request.body || {};
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return response.status(200).json({ status: 'success', simulated: true });
    }

    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generated_signature = hmac.digest('hex');

      if (generated_signature === razorpay_signature) {
        return response.status(200).json({ status: 'success' });
      } else {
        return response.status(400).json({ status: 'failure', error: 'Invalid signature' });
      }
    } catch (error) {
      console.error('Signature Verification Error:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return response.status(404).json({ error: 'Not found' });
}
