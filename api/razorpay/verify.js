import crypto from 'crypto';

export default async function handler(request, response) {
  // Handle CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body;
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    // If no secret configured, assume simulated success for development
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
