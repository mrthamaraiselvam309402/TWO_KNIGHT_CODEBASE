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

  try {
    const { action, username, password } = request.body;

    if (action !== 'login') {
      return response.status(400).json({ error: 'Unknown action' });
    }

    // Read credentials from environment variables (set these in Vercel dashboard)
    const masterUser = process.env.MASTER_USERNAME || 'Tom@193';
    const masterPass = process.env.MASTER_PASSWORD || 'Thamaraiselvam@309402$';
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === masterUser && password === masterPass) {
      return response.status(200).json({
        success: true,
        token: 'master-token-' + Date.now(),
        role: 'master'
      });
    }

    if (username === adminUser && password === adminPass) {
      return response.status(200).json({
        success: true,
        token: 'admin-token-' + Date.now(),
        role: 'admin'
      });
    }

    return response.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Auth error:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}
