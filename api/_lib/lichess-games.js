export default async function handler(request) {
  try {
    // request.url can be relative on some runtimes; a base makes parsing safe everywhere.
    const url = new URL(request.url, 'http://localhost');
    const username = url.searchParams.get('username');
    const max = url.searchParams.get('max') || '10';
    const pgnInJson = url.searchParams.get('pgnInJson') || 'true';

    if (!username) {
      return new Response(JSON.stringify({ error: 'Missing username parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const target = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${encodeURIComponent(max)}&pgnInJson=${encodeURIComponent(pgnInJson)}`;

    // Tight timeout keeps us under Vercel's 10s serverless limit.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch(target, {
        headers: {
          'Accept': 'application/x-ndjson',
          'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Lichess games API error', status: response.status }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const text = await response.text();
    const lines = text.split('\n').filter((line) => line.trim());
    const games = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return new Response(JSON.stringify(games), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=120, stale-while-revalidate=300'
      }
    });
  } catch (err) {
    console.error('Lichess games proxy error:', err);
    const timedOut = err && err.name === 'AbortError';
    return new Response(JSON.stringify({
      error: timedOut ? 'Lichess games request timed out' : 'Failed to fetch games from Lichess',
      details: err.message
    }), {
      status: timedOut ? 504 : 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
