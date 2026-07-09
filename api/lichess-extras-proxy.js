export default async function handler(request) {
  try {
    // request.url can be relative on some runtimes; a base makes parsing safe everywhere.
    const url = new URL(request.url, 'http://localhost');
    const username = url.searchParams.get('username');
    if (!username) {
      return new Response(JSON.stringify({ error: 'Missing username parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    // Tight timeouts keep us under Vercel's 10s serverless limit.
    const fetchWithTimeout = async (target, timeoutMs) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(target, { headers, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const [trophiesResult, statusResult] = await Promise.allSettled([
      fetchWithTimeout(`https://lichess.org/api/user/${encodeURIComponent(username)}/trophies`, 5000),
      // Correct lichess endpoint: /api/users/status?ids=<comma-separated usernames>
      fetchWithTimeout(`https://lichess.org/api/users/status?ids=${encodeURIComponent(username)}`, 5000)
    ]);

    let trophies = [];
    if (trophiesResult.status === 'fulfilled' && trophiesResult.value.ok) {
      trophies = await trophiesResult.value.json().catch(() => []);
      if (!Array.isArray(trophies)) trophies = [];
    }

    let status = {};
    if (statusResult.status === 'fulfilled' && statusResult.value.ok) {
      const arr = await statusResult.value.json().catch(() => []);
      // Endpoint returns an array like [{ id, name, online, playing }]
      if (Array.isArray(arr) && arr.length > 0) status = arr[0];
      else if (arr && !Array.isArray(arr)) status = arr;
    }

    return new Response(JSON.stringify({ trophies, status }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=120, stale-while-revalidate=300'
      }
    });
  } catch (err) {
    console.error('Lichess extras proxy error:', err);
    // Extras are decorative — degrade gracefully instead of failing the page with a 500.
    return new Response(JSON.stringify({ trophies: [], status: {}, degraded: true, details: err.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
