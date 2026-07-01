/**
 * Rate Limiting Module for API Endpoints
 * Uses Supabase for distributed rate limiting
 */

import { verifySignedToken } from '../_verify_token.js';

// Helper for decoding JWT payload
function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Rate limit configuration
const RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, max: 5 },        // 5 attempts per 15 minutes
  students: { windowMs: 60 * 1000, max: 100 },       // 100 requests per minute
  payments: { windowMs: 60 * 1000, max: 100 },       // 100 requests per minute
  default: { windowMs: 60 * 1000, max: 60 }          // 60 requests per minute
};

/**
 * Check rate limit for a given key
 */
export async function checkRateLimit(key, endpoint = 'default') {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  const windowMs = config.windowMs;
  const maxRequests = config.max;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) return checkRateLimitInMemory(key, endpoint);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from('rate_limits').delete().lt('timestamp', windowStart.toISOString());
    
    const { count, error } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .gte('timestamp', windowStart.toISOString());
    
    if (error) return checkRateLimitInMemory(key, endpoint);
    
    const currentRequests = count || 0;
    const allowed = currentRequests < maxRequests;
    const remaining = Math.max(0, maxRequests - currentRequests);
    const resetTime = now.getTime() + windowMs;
    
    if (allowed) {
      await supabase.from('rate_limits').insert({
        id: crypto.randomUUID(),
        key: key,
        endpoint: endpoint,
        timestamp: now.toISOString()
      });
    }
    
    return { allowed, remaining, resetTime, limit: maxRequests };
  } catch (error) {
    return checkRateLimitInMemory(key, endpoint);
  }
}

/**
 * In-memory rate limiting fallback
 */
const rateLimitStore = new Map();
function checkRateLimitInMemory(key, endpoint) {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const storeKey = `${endpoint}:${key}`;
  
  if (!rateLimitStore.has(storeKey)) rateLimitStore.set(storeKey, []);
  const requests = rateLimitStore.get(storeKey).filter(time => time > windowStart);
  const allowed = requests.length < config.max;
  if (allowed) requests.push(now);
  rateLimitStore.set(storeKey, requests);
  
  return { allowed, remaining: Math.max(0, config.max - requests.length), resetTime: now + config.windowMs, limit: config.max };
}

/**
  * Decode JWT payload without verification (for Supabase ES256 JWTs where SDK fails)
  */
 function decodeJwt(token) {
   if (!token.includes('.')) return null;
   try {
     const parts = token.split('.');
     if (parts.length !== 3) return null;
     const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
     const padded = payloadB64.padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), '=');
     const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(padded)));
     return payload;
   } catch {
     return null;
   }
 }

 function base64UrlDecode(value) {
   const binary = atob(value);
   const bytes = new Uint8Array(binary.length);
   for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
   return bytes;
 }

/**
   * Validate authentication token (Supports Master/Admin hardcoded tokens and Supabase JWTs)
   */
  export async function validateAuth(req) {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    
    // Allow any JWT token (starts with eyJ) for development/demo mode
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token && token.startsWith('eyJ')) {
        return { allowed: true, role: 'anonymous' };
      }
    }
    
    if (!authHeader) return { allowed: false, error: 'Missing Authorization header' };
    
    const token = authHeader.replace('Bearer ', '');
    if (!token) return { allowed: false, error: 'Missing token' };

    // 1. Check for hardcoded stabilization tokens
    if (token.startsWith('master-token-')) return { allowed: true, role: 'master' };
    if (token.startsWith('admin-token-')) return { allowed: true, role: 'admin' };
    if (token.startsWith('parent-token-')) return { allowed: true, role: 'parent' };
    if (token.startsWith('coach-token-')) return { allowed: true, role: 'coach' };

    // Check service role key or anon key
    if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || token === Deno.env.get('SUPABASE_ANON_KEY')) {
      return { allowed: true, role: 'service_role' };
    }

    // 2. Check for real Supabase JWT - decode manually (SDK throws on ES256 tokens)
    try {
      const payload = decodeJwt(token);
      if (payload && payload.iss?.includes('supabase.co/auth')) {
        const userRole = payload.user_metadata?.role || payload.role || 'authenticated';
        return { allowed: true, role: userRole, user: { id: payload.sub, email: payload.email, role: userRole } };
      }
    } catch (e) {
      // Token decode failed
    }

    // 3. Fallback: check custom HS256 JWT (Two Knights signed tokens)
    try {
      const customPayload = await verifySignedToken(token);
      if (customPayload) {
        return { allowed: true, role: customPayload.role || 'authenticated', user: customPayload };
      }
    } catch (e) {
      // Ignore errors - will return as invalid token
    }

    return { allowed: false, error: 'Invalid or expired token' };
  }

