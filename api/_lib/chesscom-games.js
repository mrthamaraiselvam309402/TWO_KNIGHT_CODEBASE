export default async function handler(request) {
  const url = new URL(request.url, 'http://localhost');
  const username = url.searchParams.get('username');
  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month');

  if (!username) {
    return new Response(JSON.stringify({ error: 'Missing username parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let target;
    if (year && month) {
      target = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/${encodeURIComponent(year)}/${encodeURIComponent(month)}`;
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      target = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/${y}/${m}`;
    }

    const response = await fetch(target, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'ChessKidoo-Admin/1.0 (chess academy management tool)'
      }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Chess.com games API error', status: response.status, games: [] }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const games = (data.games || []).reverse().slice(0, 20);

    return new Response(JSON.stringify({ games, total: data.games?.length || 0 }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=120, stale-while-revalidate=300'
      }
    });
  } catch (err) {
    console.error('Chess.com games proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch games from Chess.com', games: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
