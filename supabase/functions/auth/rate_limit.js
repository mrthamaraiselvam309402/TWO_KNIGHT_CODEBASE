/**
 * Rate Limiting Module for API Endpoints
 * Uses Supabase for distributed rate limiting
 */

import { validateAuth } from '../_shared_auth.js';

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