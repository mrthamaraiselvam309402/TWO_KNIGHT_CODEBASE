export default async function handler(request) {
  const startTime = Date.now();
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');
    if (!username) {
      return new Response(JSON.stringify({ error: 'Missing username parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const headers = {
      'Accept': 'application/json',
      'User-Agent': userAgent,
      'Accept-Language': 'en-US,en;q=0.9'
    };

    const profileUrl = `https://lichess.org/api/user/${encodeURIComponent(username)}`;
    const historyUrl = `https://lichess.org/api/user/${encodeURIComponent(username)}/rating-history`;

    let profile = null;
    let ratingHistory = [];
    let profileOk = false;
    let historyOk = false;
    let profileStatus = 500;
    let profileStatusText = 'Unknown';

    // Fetch profile and rating history in PARALLEL with tight timeouts.
    // Sequential fetches (6s + 4s scrape + 6s = 16s worst case) exceeded
    // Vercel's 10s serverless limit and caused 504s in production.
    const fetchWithTimeout = async (target, timeoutMs) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(target, { headers, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const [profileResult, historyResult] = await Promise.allSettled([
      fetchWithTimeout(profileUrl, 5000),
      fetchWithTimeout(historyUrl, 5000)
    ]);

    if (profileResult.status === 'fulfilled') {
      const profileRes = profileResult.value;
      profileStatus = profileRes.status;
      profileStatusText = profileRes.statusText;
      console.log(`[Lichess Proxy] Profile response for ${username}:`, profileRes.status, profileRes.statusText);
      if (profileRes.ok) {
        try { profile = await profileRes.json(); profileOk = true; } catch { profile = null; }
      }
    } else {
      console.error(`[Lichess] Profile fetch threw for ${username}:`, profileResult.reason);
    }

    if (historyResult.status === 'fulfilled') {
      const historyRes = historyResult.value;
      console.log(`[Lichess Proxy] History response for ${username}:`, historyRes.status, historyRes.statusText);
      if (historyRes.ok) {
        try {
          const text = await historyRes.text();
          const lines = text.split('\n').filter((line) => line.trim());
          ratingHistory = lines.map((line) => {
            try { return JSON.parse(line); } catch { return null; }
          }).filter(Boolean);
          historyOk = true;
        } catch { ratingHistory = []; }
      }
    } else {
      console.error(`[Lichess] Rating history fetch threw for ${username}:`, historyResult.reason);
    }

    if (!profileOk) {
      const status = profileStatus === 0 ? 500 : profileStatus;
      return new Response(JSON.stringify({
        error: status === 404 ? 'Lichess profile not found' : 'Failed to fetch Lichess profile',
        notFound: status === 404,
        upstreamStatus: status,
        upstreamStatusText: profileStatusText
      }), {
        status: status === 404 ? 404 : status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = {
      profile: profile || {},
      ratingHistory: ratingHistory || [],
      source: profileOk && !historyOk ? 'profile-only' : 'full',
      timingMs: Date.now() - startTime
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    console.error(`[Lichess] Unexpected error:`, err);
    return new Response(JSON.stringify({
      error: 'Failed to fetch from Lichess',
      details: err.message,
      stack: err.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
