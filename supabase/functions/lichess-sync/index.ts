import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const username = url.searchParams.get('username');
    const force = url.searchParams.get('force') === '1';

    if (!username) {
      return new Response(JSON.stringify({ error: 'Missing username parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    async function fetchWithTimeout(target, headers, signal, timeoutMs = 6000) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(target, { headers, signal: controller.signal });
        clearTimeout(timeout);
        return res;
      } catch (e) {
        clearTimeout(timeout);
        throw e;
      }
    }

    async function syncLichessData(uname: string): Promise<any> {
      const headers = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      };

      let profile = null;
      let ratingHistory: any[] = [];
      let profileOk = false;

      // Fetch profile
      try {
        const signal = new AbortController().signal;
        const res = await fetchWithTimeout(
          `https://lichess.org/api/user/${encodeURIComponent(uname)}`,
          headers, signal, 6000
        );
        if (res.ok) {
          profile = await res.json();
          profileOk = true;
        }
      } catch (e) {
        console.error(`[lichess-sync] Profile fetch failed for ${uname}:`, e);
      }

      // Fetch rating history
      try {
        const signal = new AbortController().signal;
        const res = await fetchWithTimeout(
          `https://lichess.org/api/user/${encodeURIComponent(uname)}/rating-history`,
          { ...headers, 'Accept': 'application/json' },
          signal, 6000
        );
        if (res.ok) {
          const text = await res.text();
          const lines = text.split('\n').filter((line) => line.trim());
          ratingHistory = lines.map((line) => {
            try { return JSON.parse(line); } catch { return null; }
          }).filter(Boolean);
        }
      } catch (e) {
        console.error(`[lichess-sync] History fetch failed for ${uname}:`, e);
      }

      if (!profileOk) {
        throw new Error('Failed to fetch Lichess profile');
      }

      // Upsert into cache
      const { error } = await supabase
        .from('lichess_cache')
        .upsert({
          lichess_username: uname,
          profile,
          rating_history: ratingHistory,
          synced_at: new Date().toISOString()
        }, { onConflict: 'lichess_username' });

      if (error) {
        console.error(`[lichess-sync] Cache upsert failed:`, error);
      }

      return { profile, ratingHistory };
    }

    if (req.method === 'POST' || force) {
      const result = await syncLichessData(username);
      return new Response(JSON.stringify({
        success: true,
        cached: true,
        data: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // GET - return cached data or trigger background sync
    const { data: cached, error } = await supabase
      .from('lichess_cache')
      .select('profile, rating_history, synced_at')
      .eq('lichess_username', username)
      .single();

    if (cached && !error) {
      const syncAge = Date.now() - new Date(cached.synced_at).getTime();
      const isStale = syncAge > 24 * 60 * 60 * 1000; // 24 hours

      if (!isStale) {
        return new Response(JSON.stringify({
          cached: true,
          stale: false,
          data: {
            profile: cached.profile,
            ratingHistory: cached.rating_history
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Return stale data immediately, trigger background refresh
      syncLichessData(username).catch((e) => {
        console.error(`[lichess-sync] Background sync failed for ${username}:`, e);
      });

      return new Response(JSON.stringify({
        cached: true,
        stale: true,
        data: {
          profile: cached.profile,
          ratingHistory: cached.rating_history
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // No cache - trigger sync and return empty response with instruction
    syncLichessData(username).catch((e) => {
      console.error(`[lichess-sync] Cache miss sync failed for ${username}:`, e);
    });

    return new Response(JSON.stringify({
      cached: false,
      notFound: true,
      error: 'No cached data. Triggering background sync.'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (err) {
    console.error('[lichess-sync] Unexpected error:', err);
    return new Response(JSON.stringify({
      error: 'Failed to process Lichess request',
      details: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
