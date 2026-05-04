/**
 * Rate Limiting Module for Auth Function
 * Local copy to avoid relative import issues in Supabase Edge Functions
 * Each function is deployed independently, so dependencies must be local
 */

const RATE_LIMITS = {
  auth:     { windowMs: 15 * 60 * 1000, max: 5 },
  students: { windowMs: 60 * 1000,      max: 100 },
  payments: { windowMs: 60 * 1000,      max: 100 },
  default:  { windowMs: 60 * 1000,      max: 60  },
};

// In-memory fallback store (used when Supabase DB is unavailable)
const memStore = new Map();

function checkInMemory(key, endpoint) {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const storeKey = `${endpoint}:${key}`;

  const requests = (memStore.get(storeKey) || []).filter((t) => t > windowStart);
  const allowed = requests.length < config.max;
  if (allowed) requests.push(now);
  memStore.set(storeKey, requests);

  return {
    allowed,
    remaining: Math.max(0, config.max - requests.length),
    resetTime: now + config.windowMs,
    limit: config.max,
  };
}

export async function checkRateLimit(key, endpoint = 'default') {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) return checkInMemory(key, endpoint);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Clean old entries
    await supabase
      .from('rate_limits')
      .delete()
      .lt('timestamp', windowStart.toISOString());

    const { count, error } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .eq('endpoint', endpoint)
      .gte('timestamp', windowStart.toISOString());

    if (error) return checkInMemory(key, endpoint);

    const current = count || 0;
    const allowed = current < config.max;

    if (allowed) {
      await supabase.from('rate_limits').insert({
        id: crypto.randomUUID(),
        key,
        endpoint,
        timestamp: now.toISOString(),
      });
    }

    return {
      allowed,
      remaining: Math.max(0, config.max - current),
      resetTime: now.getTime() + config.windowMs,
      limit: config.max,
    };
  } catch {
    return checkInMemory(key, endpoint);
  }
}
