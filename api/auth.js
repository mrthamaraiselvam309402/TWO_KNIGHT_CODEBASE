// In-memory rate limiter for serverless functions
// Note: Each Vercel function instance has its own memory, so this provides
// per-instance rate limiting. For distributed rate limiting, use Upstash Redis.
const loginAttempts = new Map();

const RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes
};

function getClientIP(request) {
  return (
    request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    request.headers['x-real-ip'] ||
    'unknown'
  );
}

function isRateLimited(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) return false;

  // Check if blocked
  if (record.blockedUntil && now < record.blockedUntil) {
    return true;
  }

  // Clean up expired block
  if (record.blockedUntil && now >= record.blockedUntil) {
    loginAttempts.delete(ip);
    return false;
  }

  // Clean old attempts outside the window
  record.attempts = record.attempts.filter(t => now - t < RATE_LIMIT.windowMs);

  return record.attempts.length >= RATE_LIMIT.maxAttempts;
}

function recordAttempt(ip, success) {
  const now = Date.now();

  if (success) {
    loginAttempts.delete(ip);
    return;
  }

  let record = loginAttempts.get(ip);
  if (!record) {
    record = { attempts: [], blockedUntil: null };
    loginAttempts.set(ip, record);
  }

  record.attempts.push(now);

  // Clean old attempts
  record.attempts = record.attempts.filter(t => now - t < RATE_LIMIT.windowMs);

  // Block if too many attempts
  if (record.attempts.length >= RATE_LIMIT.maxAttempts) {
    record.blockedUntil = now + RATE_LIMIT.blockDurationMs;
  }
}

function sanitizeInput(str, maxLength = 100) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLength).replace(/[<>"'&;]/g, '');
}

export default async function handler(request, response) {
  // CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const clientIP = getClientIP(request);
  if (isRateLimited(clientIP)) {
    return response.status(429).json({
      error: 'Too many login attempts. Please try again in 30 minutes.',
      locked: true
    });
  }

  try {
    // Validate body size (reject oversized payloads)
    const contentLength = parseInt(request.headers['content-length'] || '0');
    if (contentLength > 1024) {
      return response.status(413).json({ error: 'Request too large' });
    }

    const body = request.body;
    const { action } = body;

    if (action !== 'login') {
      return response.status(400).json({ error: 'Unknown action' });
    }

    // Sanitize inputs
    const username = sanitizeInput(body.username, 100);
    const password = sanitizeInput(body.password, 200);

    if (!username || !password) {
      return response.status(400).json({ error: 'Username and password are required' });
    }

    // Read credentials from environment variables
    const masterUser = process.env.MASTER_USERNAME;
    const masterPass = process.env.MASTER_PASSWORD;
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;

    // Validate server config
    if (!masterUser || !masterPass || !adminUser || !adminPass) {
      console.error('Auth credentials not configured in environment variables');
      return response.status(500).json({ error: 'Server configuration error' });
    }

    // Check master credentials
    if (username === masterUser && password === masterPass) {
      recordAttempt(clientIP, true);
      return response.status(200).json({
        success: true,
        token: 'master-token-' + Date.now(),
        role: 'master'
      });
    }

    // Check admin credentials
    if (username === adminUser && password === adminPass) {
      recordAttempt(clientIP, true);
      return response.status(200).json({
        success: true,
        token: 'admin-token-' + Date.now(),
        role: 'admin'
      });
    }

    // Failed attempt
    recordAttempt(clientIP, false);

    // Constant-time-ish response to prevent timing attacks
    return response.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Auth error:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}
