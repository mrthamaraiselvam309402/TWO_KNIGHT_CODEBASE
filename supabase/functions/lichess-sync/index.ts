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

  // On the Supabase edge runtime an un-awaited promise is terminated as soon
  // as the response is sent — "fire and forget" silently does nothing.
  // EdgeRuntime.waitUntil keeps the isolate alive until the work finishes.
  function runInBackground(work: Promise<unknown>, label: string) {
    const guarded = work.catch((e) => console.error(`[lichess-sync] ${label} failed:`, e));
    try {
      // deno-lint-ignore no-explicit-any
      const rt = (globalThis as any).EdgeRuntime;
      if (rt && typeof rt.waitUntil === 'function') {
        rt.waitUntil(guarded);
        return;
      }
    } catch (_) { /* not on edge runtime (local dev) */ }
  }

  // Accept both bare usernames and pasted profile URLs.
  function normalizeUsername(raw: string): string {
    const v = String(raw || '').trim();
    if (!v) return '';
    return v.startsWith('http') ? (v.split('/').filter(Boolean).pop() || '') : v;
  }

  try {
    const url = new URL(req.url);
    const username = normalizeUsername(url.searchParams.get('username') || '');
    const force = url.searchParams.get('force') === '1';
    const wantGames = url.searchParams.get('games') === '1';
    const syncAll = url.searchParams.get('all') === '1';

    if (!username && !syncAll) {
      return new Response(JSON.stringify({ error: 'Missing username parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ── Extras mode (?extras=1): trophies + online status ────────
    // Decorative data, served live from lichess.org here because the
    // Vercel egress to lichess.org stalls; degrades to empty on failure.
    if (url.searchParams.get('extras') === '1') {
      const headers = {
        'Accept': 'application/json',
        'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
      };
      const [trophiesRes, statusRes] = await Promise.allSettled([
        fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}/trophies`, { headers, signal: AbortSignal.timeout(6000) }),
        fetch(`https://lichess.org/api/users/status?ids=${encodeURIComponent(username)}`, { headers, signal: AbortSignal.timeout(6000) })
      ]);
      let trophies: unknown[] = [];
      if (trophiesRes.status === 'fulfilled' && trophiesRes.value.ok) {
        trophies = await trophiesRes.value.json().catch(() => []);
        if (!Array.isArray(trophies)) trophies = [];
      }
      let status: Record<string, unknown> = {};
      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const arr = await statusRes.value.json().catch(() => []);
        if (Array.isArray(arr) && arr.length > 0) status = arr[0];
        else if (arr && !Array.isArray(arr)) status = arr;
      }
      return new Response(JSON.stringify({ trophies, status }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=120, stale-while-revalidate=300',
          ...corsHeaders
        }
      });
    }

    // ── Recent games mode (?games=1) ─────────────────────────────
    // Served live from lichess.org through this edge function because the
    // Vercel serverless path to lichess.org stalls intermittently. NDJSON
    // export, newest first, PGN included for the game viewer.
    if (wantGames) {
      const max = Math.min(parseInt(url.searchParams.get('max') || '10', 10) || 10, 30);
      try {
        const res = await fetch(
          `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&pgnInJson=true`,
          {
            headers: {
              'Accept': 'application/x-ndjson',
              'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
            },
            signal: AbortSignal.timeout(9000)
          }
        );
        if (!res.ok) {
          return new Response(JSON.stringify({ error: 'Lichess games API error', status: res.status, games: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        const text = await res.text();
        const games = text.split('\n').filter((l) => l.trim()).map((l) => {
          try { return JSON.parse(l); } catch { return null; }
        }).filter(Boolean);
        return new Response(JSON.stringify({ games }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 's-maxage=120, stale-while-revalidate=300',
            ...corsHeaders
          }
        });
      } catch (e) {
        console.error(`[lichess-sync] Games fetch failed for ${username}:`, e);
        return new Response(JSON.stringify({ error: 'Games fetch failed', games: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
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
        // Lichess asks API clients to identify themselves; spoofed browser UAs
        // from datacenter IPs are more likely to be blocked/throttled.
        'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)',
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
          // /api/user/{u}/rating-history returns a plain JSON array:
          // [{ name: 'Bullet', points: [[y, m, d, rating], ...] }, ...]
          // (Previously parsed as NDJSON, which nested the array and broke the chart.)
          const text = await res.text();
          try {
            const parsed = JSON.parse(text);
            ratingHistory = Array.isArray(parsed) ? parsed : [];
            if (ratingHistory.length === 1 && Array.isArray(ratingHistory[0])) {
              ratingHistory = ratingHistory[0];
            }
          } catch {
            ratingHistory = [];
          }
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

    // ── Bulk mode (POST ?all=1) ──────────────────────────────────
    // Syncs every linked student in one call: reads lichess usernames from
    // the students table, dedupes, and refreshes each sequentially with a
    // rate-limit-friendly gap. Used by the daily cron and for manual warmup.
    if (syncAll && req.method === 'POST') {
      const { data: studs, error: sErr } = await supabase
        .from('students')
        .select('lichess_username')
        .not('lichess_username', 'is', null)
        .neq('lichess_username', '');
      if (sErr) {
        return new Response(JSON.stringify({ error: 'Failed to read students', details: sErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const names = [...new Set(
        (studs || [])
          .map((r: { lichess_username: string }) => normalizeUsername(r.lichess_username))
          .filter(Boolean)
          .map((u: string) => u.toLowerCase())
      )];
      const synced: string[] = [];
      const failed: { username: string; error: string }[] = [];
      for (const u of names) {
        try {
          await syncLichessData(u);
          synced.push(u);
        } catch (e) {
          failed.push({ username: u, error: String((e as Error)?.message || e) });
        }
        // Be polite to lichess.org: ~1.5 req/s across profile+history calls.
        await new Promise((r) => setTimeout(r, 700));
      }
      console.log(`[lichess-sync] bulk sync done: ${synced.length} ok, ${failed.length} failed`);
      return new Response(JSON.stringify({ success: true, total: names.length, synced, failed }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
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

      // Return stale data immediately, refresh in the background
      // (EdgeRuntime.waitUntil — a bare promise would be killed instantly).
      runInBackground(syncLichessData(username), `stale refresh for ${username}`);

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

    // No cache — sync in the background so the NEXT view is instant.
    // This was the "other students never load" bug: without waitUntil the
    // edge runtime killed this promise before it did anything.
    runInBackground(syncLichessData(username), `cache-miss sync for ${username}`);

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
