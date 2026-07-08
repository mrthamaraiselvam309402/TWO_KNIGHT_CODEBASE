export default async function handler(request) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username');
  const max = url.searchParams.get('max') || '10';
  const pgnInJson = url.searchParams.get('pgnInJson') || 'true';

  if (!username) {
    return new Response(JSON.stringify({ error: 'Missing username parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const target = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${encodeURIComponent(max)}&pgnInJson=${encodeURIComponent(pgnInJson)}`;
    const response = await fetch(target, {
      headers: { 
        'Accept': 'application/x-ndjson',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

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
    return new Response(JSON.stringify({ error: 'Failed to fetch games from Lichess' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
