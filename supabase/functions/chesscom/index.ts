// Chess.com data proxy served from Supabase edge (Deno) because Vercel's
// serverless egress to api.chess.com stalls intermittently (Cloudflare is
// hostile to that IP space). Vercel rewrites /api/chesscom-proxy,
// /api/chesscom-clubs-proxy and /api/chesscom-games-proxy here.
//
//   ?type=profile&username=u          -> player + stats merged (flat)
//   ?type=clubs&username=u            -> { clubs, tournaments }
//   ?type=games&username=u&year&month -> { games: [...last 20, newest first] }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey'
};

const UA = {
  'Accept': 'application/json',
  'User-Agent': 'TwoKnightsAcademy/1.0 (chess academy management tool)'
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra }
  });
}

async function cget(path: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(`https://api.chess.com/pub${path}`, {
      headers: UA,
      signal: AbortSignal.timeout(timeoutMs)
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    console.error(`[chesscom] fetch ${path} failed:`, e);
    return { ok: false, status: 0, data: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'profile';
    const raw = String(url.searchParams.get('username') || '').trim();
    const username = raw.startsWith('http') ? (raw.split('/').filter(Boolean).pop() || '') : raw;

    if (!username) return json({ error: 'Missing username parameter' }, 400);
    const u = encodeURIComponent(username.toLowerCase());

    if (type === 'clubs') {
      const [clubsRes, tourRes] = await Promise.allSettled([
        cget(`/player/${u}/clubs`),
        cget(`/player/${u}/tournaments`)
      ]);
      const clubs = clubsRes.status === 'fulfilled' && clubsRes.value.ok ? (clubsRes.value.data?.clubs || []) : [];
      const tournaments = tourRes.status === 'fulfilled' && tourRes.value.ok
        ? (tourRes.value.data?.finished || []).slice(0, 10)
        : [];
      return json({ clubs, tournaments }, 200, { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' });
    }

    if (type === 'games') {
      const now = new Date();
      const year = url.searchParams.get('year') || String(now.getFullYear());
      const month = String(url.searchParams.get('month') || now.getMonth() + 1).padStart(2, '0');
      const res = await cget(`/player/${u}/games/${encodeURIComponent(year)}/${month}`, 9000);
      if (!res.ok) return json({ error: 'Chess.com games API error', status: res.status, games: [] }, 200);
      const games = (res.data?.games || []).reverse().slice(0, 20);
      return json({ games, total: res.data?.games?.length || 0 }, 200, { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' });
    }

    // profile (default): merge player record + stats, flat — matches the shape
    // the frontend has always consumed from the old Vercel proxy.
    const [profileRes, statsRes] = await Promise.allSettled([
      cget(`/player/${u}`),
      cget(`/player/${u}/stats`)
    ]);
    const profile = profileRes.status === 'fulfilled' && profileRes.value.ok ? profileRes.value.data : null;
    if (!profile) {
      const status = profileRes.status === 'fulfilled' ? profileRes.value.status : 0;
      return json({ notFound: status === 404, error: 'Chess.com profile not found', upstreamStatus: status }, status === 404 ? 404 : 502);
    }
    const stats = statsRes.status === 'fulfilled' && statsRes.value.ok ? (statsRes.value.data || {}) : {};
    return json({ ...profile, ...stats, lastOnline: profile.last_online || null }, 200, {
      'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
    });
  } catch (err) {
    console.error('[chesscom] Unexpected error:', err);
    return json({ error: 'Failed to fetch from Chess.com', details: String((err as Error)?.message || err) }, 500);
  }
});
