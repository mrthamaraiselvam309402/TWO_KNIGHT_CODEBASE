/**
 * Rate Limiting Module for API Endpoints
 * Uses Supabase for distributed rate limiting
 */

// Rate limit configuration
const RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, max: 5 },        // 5 attempts per 15 minutes
  students: { windowMs: 60 * 1000, max: 100 },       // 100 requests per minute
  payments: { windowMs: 60 * 1000, max: 100 },       // 100 requests per minute
  default: { windowMs: 60 * 1000, max: 60 }          // 60 requests per minute
};

/**
 * Check rate limit for a given key
 * @param {string} key - Unique identifier (IP, user ID, etc.)
 * @param {string} endpoint - Endpoint name (auth, students, payments, etc.)
 * @returns {Promise<{allowed: boolean, remaining: number, resetTime: number}>}
 */
export async function checkRateLimit(key, endpoint = 'default') {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  const windowMs = config.windowMs;
  const maxRequests = config.max;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  
  try {
    // Use Supabase to track rate limits (distributed)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      // Fallback to in-memory rate limiting
      return checkRateLimitInMemory(key, endpoint);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Clean old entries
    await supabase
      .from('rate_limits')
      .delete()
      .lt('timestamp', windowStart.toISOString());
    
    // Count current requests
    const { count, error } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .gte('timestamp', windowStart.toISOString());
    
    if (error) {
      console.warn('Rate limit check error:', error);
      return checkRateLimitInMemory(key, endpoint);
    }
    
    const currentRequests = count || 0;
    const allowed = currentRequests < maxRequests;
    const remaining = Math.max(0, maxRequests - currentRequests);
    const resetTime = now.getTime() + windowMs;
    
    // Record this request if allowed
    if (allowed) {
      await supabase
        .from('rate_limits')
        .insert({
          id: crypto.randomUUID(),
          key: key,
          endpoint: endpoint,
          timestamp: now.toISOString()
        });
    }
    
    return {
      allowed,
      remaining,
      resetTime,
      limit: maxRequests
    };
  } catch (error) {
    console.warn('Rate limit service error:', error);
    return checkRateLimitInMemory(key, endpoint);
  }
}

/**
 * In-memory rate limiting fallback
 */
const rateLimitStore = new Map();

function checkRateLimitInMemory(key, endpoint) {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  const windowMs = config.windowMs;
  const maxRequests = config.max;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  const storeKey = `${endpoint}:${key}`;
  
  if (!rateLimitStore.has(storeKey)) {
    rateLimitStore.set(storeKey, []);
  }
  
  const requests = rateLimitStore.get(storeKey).filter(time => time > windowStart);
  rateLimitStore.set(storeKey, requests);
  
  const allowed = requests.length < maxRequests;
  
  if (allowed) {
    requests.push(now);
    rateLimitStore.set(storeKey, requests);
  }
  
  const remaining = Math.max(0, maxRequests - requests.length);
  const resetTime = now + windowMs;
  
  return {
    allowed,
    remaining,
    resetTime,
    limit: maxRequests
  };
}

/**
 * Rate limit middleware for Edge Functions
 */
export async function withRateLimit(req, endpoint = 'default') {
  const url = new URL(req.url);
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             'unknown';
  const key = `${ip}:${endpoint}`;
  
  const result = await checkRateLimit(key, endpoint);
  
  if (!result.allowed) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again later.`,
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      limit: result.limit,
      remaining: result.remaining,
      resetTime: new Date(result.resetTime).toISOString()
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetTime),
        'Retry-After': String(Math.ceil((result.resetTime - Date.now()) / 1000))
      }
    });
  }
  
  // Add rate limit headers to successful responses
  return {
    result,
    headers: {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.resetTime)
    }
  };
}

/**
 * Create rate limit table in Supabase
 */
export const createRateLimitTableSQL = `
  CREATE TABLE IF NOT EXISTS rate_limits (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
  CREATE INDEX IF NOT EXISTS idx_rate_limits_timestamp ON rate_limits(timestamp);
  CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);
`;
